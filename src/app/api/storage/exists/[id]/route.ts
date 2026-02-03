import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { existsSync } from 'fs';
import path from 'path';

// Configuration
const STORAGE_DIR = process.env.STORAGE_DIR || './uploads';

// Get user subdirectory path (avatars, coverart, tracks)
function getUserSubdirPath(userId: string, subdir: string): string {
  return path.join(STORAGE_DIR, 'users', userId, subdir);
}

// Allowed extensions for different file types
const FILE_EXTENSIONS = {
  audio: ['.mp3', '.ogg', '.wav', '.flac', '.m4a'],
  image: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  avatar: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  coverArt: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
};

// HEAD /api/storage/exists/:id - Check if file exists
export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new NextResponse(null, { status: 401 });
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token);

    if (!payload) {
      return new NextResponse(null, { status: 401 });
    }

    const userId = payload.userId as string;
    const { id } = await params;

    // Get fileType from URL query params
    const { searchParams } = new URL(request.url);
    const fileType = (searchParams.get('fileType') as string) || 'audio';

    // Determine subdirectory based on file type
    const subdir = fileType === 'avatar' ? 'avatars' : fileType === 'coverArt' ? 'coverart' : 'tracks';
    const subdirPath = getUserSubdirPath(userId, subdir);

    // Find file (check all possible extensions)
    const extensions = FILE_EXTENSIONS[fileType as keyof typeof FILE_EXTENSIONS] || FILE_EXTENSIONS.audio;

    for (const ext of extensions) {
      const candidatePath = path.join(subdirPath, `${id}${ext}`);
      if (existsSync(candidatePath)) {
        return new NextResponse(null, { status: 200 });
      }
    }

    return new NextResponse(null, { status: 404 });
  } catch (error) {
    return new NextResponse(null, { status: 500 });
  }
}

// GET /api/storage/exists/:id - Check if file exists (with JSON response)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token);

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const userId = payload.userId as string;
    const { id } = await params;

    // Get fileType from URL query params
    const { searchParams } = new URL(request.url);
    const fileType = (searchParams.get('fileType') as string) || 'audio';

    // Determine subdirectory based on file type
    const subdir = fileType === 'avatar' ? 'avatars' : fileType === 'coverArt' ? 'coverart' : 'tracks';
    const subdirPath = getUserSubdirPath(userId, subdir);

    // Find file (check all possible extensions)
    const extensions = FILE_EXTENSIONS[fileType as keyof typeof FILE_EXTENSIONS] || FILE_EXTENSIONS.audio;

    for (const ext of extensions) {
      const candidatePath = path.join(subdirPath, `${id}${ext}`);
      if (existsSync(candidatePath)) {
        return NextResponse.json({
          exists: true,
          id,
          fileType,
        });
      }
    }

    return NextResponse.json({
      exists: false,
      id,
      fileType,
    });
  } catch (error) {
    console.error('Exists check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
