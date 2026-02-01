import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth/jwt';

// POST /api/upload - Get upload URL and initialize upload
export async function POST(request: NextRequest) {
  try {
    // Get token from header
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

    // Check if user has completed onboarding
    if (!payload.onboardingCompleted) {
      return NextResponse.json(
        { error: 'Onboarding incomplete' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { fileName, fileSize, mimeType } = body;

    // Validate file size (100MB limit)
    const MAX_FILE_SIZE = 100 * 1024 * 1024;
    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 100MB' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/flac', 'audio/m4a'];
    if (!allowedTypes.includes(mimeType)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only audio files are allowed' },
        { status: 400 }
      );
    }

    // Check user's upload quota
    const userResult = await query(
      'SELECT daily_upload_quota, total_upload_quota FROM users WHERE id = $1',
      [payload.userId]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const user = userResult.rows[0];

    // TODO: Check actual quota usage against limits
    // For now, just return success with upload session info

    // Generate upload session ID
    const uploadSessionId = crypto.randomUUID();

    return NextResponse.json({
      success: true,
      uploadSessionId,
      maxFileSize: MAX_FILE_SIZE,
      allowedTypes,
    });
  } catch (error) {
    console.error('Upload init error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
