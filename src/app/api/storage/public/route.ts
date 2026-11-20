import { NextRequest, NextResponse } from 'next/server';
import { retrieveFromServer } from '@/lib/storage/unifiedStorage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Public avatar delivery.
 *
 * Avatars are profile-visible data, so they can be rendered in <img> tags
 * without a Bearer header. Both identifiers are validated as UUIDs and the
 * file type is fixed to prevent path traversal or arbitrary file reads.
 */
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  const fileId = request.nextUrl.searchParams.get('id');

  if (!userId || !fileId || !UUID_RE.test(userId) || !UUID_RE.test(fileId)) {
    return NextResponse.json({ error: 'Invalid avatar reference' }, { status: 400 });
  }

  try {
    const file = await retrieveFromServer(userId, fileId, 'avatar');
    return new NextResponse(new Uint8Array(file.buffer), {
      status: 200,
      headers: {
        'Content-Type': file.mimeType,
        'Content-Length': String(file.size),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Avatar not found' }, { status: 404 });
  }
}
