import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { createMediaUrl } from '@/lib/media/signed-url';

export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * GET /api/media/token?trackId=<uuid>
 * Issues a short-lived playback URL. Tracks in the feed are public metadata,
 * so no login is required; the token is scoped to a single track and expires.
 */
export async function GET(request: NextRequest) {
  const trackId = request.nextUrl.searchParams.get('trackId');
  if (!trackId || !UUID_RE.test(trackId)) {
    return NextResponse.json({ error: 'Invalid track id' }, { status: 400 });
  }

  try {
    const result = await query(
      `SELECT id, storage_type, server_storage_id, ipfs_cid
         FROM posts WHERE id = $1`,
      [trackId]
    );
    const track = result.rows[0] as
      | { id: string; storage_type: string; server_storage_id: string | null; ipfs_cid: string | null }
      | undefined;
    if (!track) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }
    const playable =
      Boolean(track.server_storage_id) ||
      track.storage_type === 'server' ||
      track.storage_type === 'hybrid' ||
      (track.storage_type === 'ipfs' && Boolean(track.ipfs_cid));
    if (!playable) {
      return NextResponse.json({ error: 'Track is not playable' }, { status: 409 });
    }
    return NextResponse.json(
      { url: createMediaUrl(trackId) },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Media token error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
