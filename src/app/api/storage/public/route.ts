import { NextRequest, NextResponse } from 'next/server';
import { retrieveFromServer } from '@/lib/storage/unifiedStorage';
import { isUuid, PUBLIC_IMAGE_FILE_TYPES, type PublicImageFileType } from '@/lib/storage/public-url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Public image delivery for avatars and cover art.
 *
 * These images are profile/content-visible data, so they can be rendered in
 * <img> tags without a Bearer header. Identifiers are validated as UUIDs and
 * the file type is fixed to an allowlist to prevent path traversal.
 */
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  const fileId = request.nextUrl.searchParams.get('id');
  const rawFileType = request.nextUrl.searchParams.get('fileType') || 'avatar';

  if (
    !isUuid(userId) ||
    !isUuid(fileId) ||
    !PUBLIC_IMAGE_FILE_TYPES.includes(rawFileType as PublicImageFileType)
  ) {
    return NextResponse.json({ error: 'Invalid image reference' }, { status: 400 });
  }

  try {
    const file = await retrieveFromServer(userId, fileId, rawFileType);
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
    return NextResponse.json({ error: 'Image not found' }, { status: 404 });
  }
}
