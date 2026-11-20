import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth/jwt';
import { verifyMediaToken, DEFAULT_MEDIA_TOKEN_TTL } from '@/lib/media/signed-url';
import { parseRangeHeader, readMediaRange } from '@/lib/media/storage-reader';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface MediaRow {
  id: string;
  author_id: string;
  storage_type: string;
  server_storage_id: string | null;
  file_size: number | null;
  mime_type: string | null;
  ipfs_gateway_url: string | null;
  ipfs_cid: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * GET /api/media/:trackId
 * Authorized, range-capable media streaming. A signed `token` query parameter
 * is produced by /api/media/token; a Bearer token from the owner/admin also
 * works for direct API clients.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ trackId: string }> }
) {
  try {
    const { trackId } = await context.params;
    if (!UUID_RE.test(trackId)) {
      return NextResponse.json({ error: 'Invalid track id' }, { status: 400 });
    }

    const token = request.nextUrl.searchParams.get('token');
    let authorized = verifyMediaToken(trackId, token);

    if (!authorized) {
      const authHeader = request.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const payload = await verifyToken(authHeader.slice(7));
        if (payload) {
          const owner = await query('SELECT author_id FROM posts WHERE id = $1', [trackId]);
          const row = owner.rows[0] as { author_id: string } | undefined;
          authorized = Boolean(
            row && (row.author_id === payload.userId || payload.role === 'superadmin')
          );
        }
      }
    }

    if (!authorized) {
      return NextResponse.json({ error: 'Forbidden or expired media token' }, { status: 403 });
    }

    const result = await query(
      `SELECT id, author_id, storage_type, server_storage_id, file_size, mime_type,
              ipfs_gateway_url, ipfs_cid
         FROM posts WHERE id = $1`,
      [trackId]
    );
    const track = result.rows[0] as MediaRow | undefined;
    if (!track) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    // The server copy always wins. IPFS is used only when no server bytes exist
    // or a legacy row still points at a server copy that has been removed.
    const gateway =
      track.ipfs_gateway_url ||
      (track.ipfs_cid ? `https://ipfs.io/ipfs/${track.ipfs_cid}` : null);
    const canUseIpfs = Boolean(
      gateway && (track.storage_type === 'ipfs' || track.storage_type === 'hybrid')
    );

    const redirectToIpfs = () => {
      if (!gateway) {
        return NextResponse.json({ error: 'No playable media location' }, { status: 404 });
      }
      let target: URL;
      try {
        target = new URL(gateway);
      } catch {
        return NextResponse.json({ error: 'Invalid IPFS gateway URL' }, { status: 502 });
      }
      if (target.protocol !== 'https:' && target.protocol !== 'http:') {
        return NextResponse.json({ error: 'Invalid IPFS gateway URL' }, { status: 502 });
      }
      return NextResponse.redirect(target, 307);
    };

    if (!track.server_storage_id) {
      return canUseIpfs ? redirectToIpfs() : NextResponse.json({ error: 'No playable media location' }, { status: 404 });
    }

    // Use the recorded plaintext size; probe only for legacy rows without one.
    let total = Number(track.file_size) || 0;
    let isRange = false;
    let start = 0;
    let end = 0;
    let slice;
    try {
      if (!total) {
        const probe = await readMediaRange(
          track.author_id,
          track.server_storage_id,
          'audio',
          0,
          0
        );
        total = probe.total || 0;
      }

      const rangeHeader = request.headers.get('range');
      const range = parseRangeHeader(rangeHeader, total);
      if (rangeHeader && !range) {
        return new NextResponse(null, {
          status: 416,
          headers: {
            'Accept-Ranges': 'bytes',
            'Content-Range': `bytes */${total}`,
          },
        });
      }
      isRange = Boolean(range);
      start = range?.start ?? 0;
      end = range?.end ?? Math.max(0, total - 1);
      slice = await readMediaRange(
        track.author_id,
        track.server_storage_id,
        'audio',
        start,
        end
      );
    } catch (error) {
      if (!canUseIpfs) throw error;
      console.warn('Server media read failed; falling back to IPFS', error);
      return redirectToIpfs();
    }

    const headers = new Headers({
      'Content-Type': track.mime_type || 'audio/mpeg',
      'Accept-Ranges': 'bytes',
      'Content-Length': String(slice.data.length),
      'Cache-Control': `private, max-age=${DEFAULT_MEDIA_TOKEN_TTL}`,
      'X-Content-Type-Options': 'nosniff',
    });
    if (isRange) {
      headers.set('Content-Range', `bytes ${start}-${Math.min(end, total - 1)}/${total}`);
    }

    if (request.method === 'HEAD') {
      return new NextResponse(null, { status: isRange ? 206 : 200, headers });
    }

    return new NextResponse(new Uint8Array(slice.data), {
      status: isRange ? 206 : 200,
      headers,
    });
  } catch (error) {
    console.error('Media stream error:', error);
    return NextResponse.json({ error: 'Unable to stream media' }, { status: 500 });
  }
}

export async function HEAD(
  request: NextRequest,
  context: { params: Promise<{ trackId: string }> }
) {
  return GET(request, context);
}
