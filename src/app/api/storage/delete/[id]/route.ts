import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { unlink } from 'fs/promises';
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

// DELETE /api/storage/delete/:id - Delete a file from server filesystem
export async function DELETE(
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

    // Find file (check all possible extensions in user's subdirectory)
    let filePath: string | null = null;
    const extensions = FILE_EXTENSIONS[fileType as keyof typeof FILE_EXTENSIONS] || FILE_EXTENSIONS.audio;

    for (const ext of extensions) {
      const candidatePath = path.join(subdirPath, `${id}${ext}`);
      if (existsSync(candidatePath)) {
        filePath = candidatePath;
        break;
      }
    }

    if (!filePath) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Delete file
    await unlink(filePath);

    return NextResponse.json({
      success: true,
      id,
      fileType,
    });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
