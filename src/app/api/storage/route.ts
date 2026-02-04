import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import {
  uploadFileWithBalancing,
  retrieveFileUnified,
  deleteFileUnified,
  checkUserQuota,
  getStorageStats,
  checkAndBalanceStorage,
  FILE_TYPES,
} from '@/lib/storage/unifiedStorage';

// ============================================
// POST /api/storage - Upload a file
// Uses unified storage with quota management
// ============================================
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
    const metadataStr = formData.get('metadata') as string | null;

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

    // Check user quota before upload
    const quotaCheck = await checkUserQuota(userId, file.size);
    
    if (!quotaCheck.allowed) {
      return NextResponse.json(
        { error: 'Storage quota exceeded. Cannot upload file.' },
        { status: 403 }
      );
    }

    // Parse metadata if provided
    let metadata = undefined;
    if (metadataStr) {
      try {
        metadata = JSON.parse(metadataStr);
      } catch (e) {
        console.error('Failed to parse metadata:', e);
      }
    }

    // Upload using unified storage with automatic balancing
    const result = await uploadFileWithBalancing(userId, {
      file,
      fileType,
      metadata,
    });

    // Return success with file info
    const response: Record<string, any> = {
      success: true,
      id: result.fileId,
      storageType: result.storageType,
      size: result.size,
      mimeType: file.type,
      fileType,
      instantReady: result.instantReady,
      timestamp: Date.now(),
    };

    if (result.storageType === 'server') {
      response.url = result.url;
    } else {
      response.cid = result.cid;
      response.gatewayUrl = result.gatewayUrl;
    }

    // Add quota information
    response.quotaInfo = {
      serverStorageAvailable: quotaCheck.serverStorageAvailable,
      excessForP2P: quotaCheck.excessForP2P,
      serverStorageUsed: quotaCheck.serverStorageUsed,
      p2pStorageUsed: quotaCheck.p2pStorageUsed,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// GET /api/storage - Get storage info or download
// ============================================
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
    const { searchParams } = new URL(request.url);

    // Check if this is a stats request
    const statsOnly = searchParams.get('stats') === 'true';

    if (statsOnly) {
      const stats = await getStorageStats(userId);
      if (!stats) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        stats,
      });
    }

    // Download request
    const fileId = searchParams.get('id');
    const fileType = (searchParams.get('fileType') as string) || 'audio';
    const storageType = (searchParams.get('storageType') as 'server' | 'ipfs' | 'hybrid') || 'server';

    if (!fileId) {
      return NextResponse.json(
        { error: 'File ID required' },
        { status: 400 }
      );
    }

    const result = await retrieveFileUnified(userId, storageType, fileId, fileType);

    if (result.buffer) {
      // Server storage - return file directly
      return new NextResponse(result.buffer as unknown as BodyInit, {
        headers: {
          'Content-Type': result.mimeType,
          'Content-Length': result.size.toString(),
          'Cache-Control': 'public, max-age=31536000',
        },
      });
    }

    // IPFS storage - return CID for client-side retrieval
    return NextResponse.json({
      success: true,
      cid: result.cid,
      mimeType: result.mimeType,
      size: result.size,
      storageType,
      retrievalMethod: 'p2p',
    });
  } catch (error) {
    console.error('Storage access error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE /api/storage - Delete a file
// ============================================
export async function DELETE(request: NextRequest) {
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
    const { searchParams } = new URL(request.url);

    const fileId = searchParams.get('id');
    const fileType = (searchParams.get('fileType') as string) || 'audio';
    const storageType = (searchParams.get('storageType') as 'server' | 'ipfs' | 'hybrid') || 'server';

    if (!fileId) {
      return NextResponse.json(
        { error: 'File ID required' },
        { status: 400 }
      );
    }

    const deleted = await deleteFileUnified(userId, storageType, fileId, fileType);

    if (!deleted) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
