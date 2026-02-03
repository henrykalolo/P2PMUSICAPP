import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { writeFile, mkdir, stat, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';

// Configuration
const STORAGE_DIR = process.env.STORAGE_DIR || './uploads';
const MAX_AUDIO_SIZE = 100 * 1024 * 1024; // 100MB for audio
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB for images

// Get user-specific storage directory path
function getUserStoragePath(userId: string): string {
  return path.join(STORAGE_DIR, 'users', userId);
}

// Get user subdirectory path (avatars, coverart, tracks)
function getUserSubdirPath(userId: string, subdir: string): string {
  return path.join(STORAGE_DIR, 'users', userId, subdir);
}

// Ensure user directory exists
async function ensureUserDir(userId: string): Promise<string> {
  const userDir = getUserStoragePath(userId);
  try {
    await mkdir(userDir, { recursive: true });
    return userDir;
  } catch (error) {
    console.error('Failed to create user directory:', error);
    throw new Error('User storage directory not available');
  }
}

// Ensure user subdirectory exists
async function ensureUserSubdir(userId: string, subdir: string): Promise<string> {
  const subdirPath = getUserSubdirPath(userId, subdir);
  try {
    await mkdir(subdirPath, { recursive: true });
    return subdirPath;
  } catch (error) {
    console.error('Failed to create user subdirectory:', error);
    throw new Error('User storage subdirectory not available');
  }
}

// Generate unique file ID
function generateFileId(): string {
  return crypto.randomUUID();
}

// Allowed file types configuration
const FILE_TYPES = {
  audio: {
    maxSize: MAX_AUDIO_SIZE,
    allowedTypes: ['audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/flac', 'audio/m4a'],
    extensions: ['.mp3', '.ogg', '.wav', '.flac', '.m4a'],
  },
  image: {
    maxSize: MAX_IMAGE_SIZE,
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  },
  avatar: {
    maxSize: MAX_IMAGE_SIZE,
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  },
  coverArt: {
    maxSize: MAX_IMAGE_SIZE,
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  },
};

// POST /api/storage/upload - Upload a file to server filesystem
export async function POST(request: NextRequest) {
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

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const fileType = (formData.get('fileType') as string) || 'audio';

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Get file type configuration
    const typeConfig = FILE_TYPES[fileType as keyof typeof FILE_TYPES];
    if (!typeConfig) {
      return NextResponse.json(
        { error: 'Invalid file type category' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > typeConfig.maxSize) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${typeConfig.maxSize / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Validate file type
    if (!typeConfig.allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type. Allowed types: ${typeConfig.allowedTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Ensure proper subdirectory exists
    const subdir = fileType === 'avatar' ? 'avatars' : fileType === 'coverArt' ? 'coverart' : 'tracks';
    const subdirPath = await ensureUserSubdir(userId, subdir);

    // Generate unique file ID and filename
    const fileId = generateFileId();
    const ext = path.extname(file.name) || typeConfig.extensions[0];
    const filename = `${fileId}${ext}`;
    const filePath = path.join(subdirPath, filename);

    // Convert File to Buffer and save
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await writeFile(filePath, buffer);

    // Return success with file info
    return NextResponse.json({
      success: true,
      id: fileId,
      path: filePath,
      filename: file.name,
      size: file.size,
      mimeType: file.type,
      fileType,
      timestamp: Date.now(),
      url: `/api/storage/download?id=${fileId}&fileType=${fileType}`,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/storage/download - Download a file from server filesystem
export async function GET(request: NextRequest) {
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

    // Get parameters from URL
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('id');
    const fileType = (searchParams.get('fileType') as string) || 'audio';

    if (!fileId) {
      return NextResponse.json(
        { error: 'File ID required' },
        { status: 400 }
      );
    }

    // Determine subdirectory based on file type
    const subdir = fileType === 'avatar' ? 'avatars' : fileType === 'coverArt' ? 'coverart' : 'tracks';
    const subdirPath = getUserSubdirPath(userId, subdir);

    // Find file (check all possible extensions)
    let filePath: string | null = null;
    const extensions = FILE_TYPES[fileType as keyof typeof FILE_TYPES]?.extensions || ['.mp3', '.ogg', '.wav', '.flac', '.m4a'];

    for (const ext of extensions) {
      const candidatePath = path.join(subdirPath, `${fileId}${ext}`);
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

    // Read file
    const buffer = await readFile(filePath);
    const stats = await stat(filePath);

    // Determine mime type from extension
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.mp3': 'audio/mpeg',
      '.ogg': 'audio/ogg',
      '.wav': 'audio/wav',
      '.flac': 'audio/flac',
      '.m4a': 'audio/mp4',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };
    const mimeType = mimeTypes[ext] || 'application/octet-stream';

    // Return file
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Length': stats.size.toString(),
        'Content-Disposition': `attachment; filename="${fileId}${ext}"`,
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
