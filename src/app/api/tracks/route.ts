import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth/jwt';
import {
  checkUserQuota,
  getStorageStats,
  storeOnServer,
  storeOnP2P,
  checkAndBalanceStorage,
  type ServerStorageResult,
  type P2PStorageResult,
} from '@/lib/storage/unifiedStorage';

// ============================================
// GET /api/tracks - Get all tracks
// ============================================
export async function GET(request: NextRequest) {
  try {
    // Check if DATABASE_URL is configured
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const artist = searchParams.get('artist');
    const genre = searchParams.get('genre');

    let sql = `
      SELECT
        p.id,
        p.title,
        p.artist,
        p.album,
        p.genre,
        p.year,
        p.duration_seconds as duration,
        p.magnet_uri,
        p.ipfs_cid,
        p.ipfs_metadata_cid,
        p.ipfs_gateway_url,
        p.storage_type,
        p.server_storage_id,
        p.cover_art_url,
        p.file_size,
        p.mime_type,
        p.created_at,
        u.id as author_id,
        u.username as author_username,
        u.avatar_url as author_avatar,
        u.badge as author_badge,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
        (SELECT COUNT(*) FROM reposts WHERE post_id = p.id) as reposts_count
      FROM posts p
      JOIN users u ON p.author_id = u.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramIndex = 1;

    if (artist) {
      sql += ` AND p.artist ILIKE $${paramIndex}`;
      params.push(`%${artist}%`);
      paramIndex++;
    }

    if (genre) {
      sql += ` AND p.genre ILIKE $${paramIndex}`;
      params.push(`%${genre}%`);
      paramIndex++;
    }

    sql += ` ORDER BY p.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await query(sql, params);

    return NextResponse.json({
      success: true,
      tracks: result.rows.map((row: Record<string, any>) => ({
        id: row.id,
        title: row.title,
        artist: row.artist,
        album: row.album,
        genre: row.genre,
        year: row.year,
        duration: row.duration,
        magnetUri: row.magnet_uri,
        ipfsCid: row.ipfs_cid,
        ipfsMetadataCid: row.ipfs_metadata_cid,
        ipfsGatewayUrl: row.ipfs_gateway_url,
        storageType: row.storage_type,
        serverStorageId: row.server_storage_id,
        coverArtUrl: row.cover_art_url,
        fileSize: row.file_size,
        mimeType: row.mime_type,
        createdAt: row.created_at,
        instantReady: row.storage_type === 'server', // Server storage = instant rendering
        author: {
          id: row.author_id,
          username: row.author_username,
          avatarUrl: row.author_avatar,
          badge: row.author_badge,
        },
        likesCount: parseInt(row.likes_count),
        commentsCount: parseInt(row.comments_count),
        repostsCount: parseInt(row.reposts_count),
      })),
      pagination: {
        limit,
        offset,
        total: result.rowCount,
      },
    });
  } catch (error) {
    console.error('Get tracks error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================
// POST /api/tracks - Create a new track
// Uses unified storage with quota management
// ============================================
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

    // Check if user can upload
    const userResult = await query(
      'SELECT can_upload FROM users WHERE id = $1',
      [payload.userId]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const user = userResult.rows[0];

    if (!user.can_upload) {
      return NextResponse.json(
        { error: 'Upload permission denied' },
        { status: 403 }
      );
    }

    // Parse multipart form data for file upload
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const title = formData.get('title') as string;
    const artist = formData.get('artist') as string;
    const album = formData.get('album') as string;
    const genre = formData.get('genre') as string;
    const year = formData.get('year') ? parseInt(formData.get('year') as string) : undefined;
    const duration = formData.get('duration') ? parseInt(formData.get('duration') as string) : undefined;
    const coverArtUrl = formData.get('coverArtUrl') as string;
    
    // Metadata-only mode (file already uploaded via /api/storage)
    const metadataOnly = formData.get('metadataOnly') === 'true';
    const serverStorageId = formData.get('serverStorageId') as string;
    const ipfsCid = formData.get('ipfsCid') as string;

    // Validate required fields
    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    let storageType: 'server' | 'ipfs' | 'hybrid' = 'server';
    let serverStorageIdResult: string | null = null;
    let ipfsCidResult: string | null = null;
    let ipfsGatewayUrl: string | null = null;
    let fileSize = 0;
    let mimeType = 'audio/mpeg';
    let instantReady = true;

    // If file is provided directly, upload using unified storage
    if (file && !metadataOnly) {
      // Check server storage and balance if needed before upload
      if (file.size > 10 * 1024 * 1024) { // Only balance for files > 10MB
        await checkAndBalanceStorage();
      }
      
      mimeType = file.type;
      fileSize = file.size;

      // Check quota
      const quotaCheck = await checkUserQuota(payload.userId, file.size);
      
      if (!quotaCheck.allowed) {
        return NextResponse.json(
          { error: 'Storage quota exceeded. Cannot upload file.' },
          { status: 403 }
        );
      }

      // Use unified storage (server priority, P2P fallback)
      if (quotaCheck.serverStorageAvailable) {
        // Upload to server storage (instant rendering)
        const serverResult = await storeOnServer(payload.userId, file, 'audio') as ServerStorageResult;
        storageType = 'server';
        serverStorageIdResult = serverResult.fileId;
        instantReady = serverResult.instantReady;
      } else if (quotaCheck.excessForP2P) {
        // Upload to P2P storage (fallback for excess data)
        const p2pResult = await storeOnP2P(file, { title, artist, album, genre, year, duration, uploadedBy: payload.userId }) as P2PStorageResult;
        storageType = 'ipfs';
        ipfsCidResult = p2pResult.cid;
        ipfsGatewayUrl = p2pResult.gatewayUrl;
        instantReady = p2pResult.instantReady;
      } else {
        return NextResponse.json(
          { error: 'Storage quota exceeded' },
          { status: 403 }
        );
      }
    } else if (serverStorageId) {
      // Using server storage with pre-uploaded file
      storageType = 'server';
      serverStorageIdResult = serverStorageId;
      instantReady = true;
    } else if (ipfsCid) {
      // Using IPFS storage
      storageType = 'ipfs';
      ipfsCidResult = ipfsCid;
      ipfsGatewayUrl = `https://ipfs.io/ipfs/${ipfsCid}`;
      instantReady = false;
    }

    // Check for duplicate CID if provided
    if (ipfsCidResult) {
      const existingResult = await query(
        'SELECT id FROM posts WHERE ipfs_cid = $1',
        [ipfsCidResult]
      );

      if (existingResult.rows.length > 0) {
        return NextResponse.json(
          { error: 'Track with this CID already exists' },
          { status: 409 }
        );
      }
    }

    // Insert track into database
    const result = await query(
      `INSERT INTO posts (
        author_id,
        title,
        artist,
        album,
        genre,
        year,
        duration_seconds,
        ipfs_cid,
        ipfs_metadata_cid,
        ipfs_gateway_url,
        storage_type,
        server_storage_id,
        file_size,
        mime_type,
        cover_art_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        payload.userId,
        title,
        artist || 'Unknown Artist',
        album || 'Unknown Album',
        genre || '',
        year || new Date().getFullYear(),
        duration || 0,
        ipfsCidResult,
        null, // metadata CID
        ipfsGatewayUrl,
        storageType,
        serverStorageIdResult,
        fileSize,
        mimeType,
        coverArtUrl || null,
      ]
    );

    // Update user's upload tracking
    await query(
      'UPDATE users SET updated_at = NOW() WHERE id = $1',
      [payload.userId]
    );

    const track = result.rows[0];

    return NextResponse.json({
      success: true,
      track: {
        id: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album,
        genre: track.genre,
        year: track.year,
        duration: track.duration_seconds,
        storageType: track.storage_type,
        serverStorageId: track.server_storage_id,
        ipfsCid: track.ipfs_cid,
        ipfsGatewayUrl: track.ipfs_gateway_url,
        fileSize: track.file_size,
        mimeType: track.mime_type,
        coverArtUrl: track.cover_art_url,
        instantReady, // Track is instantly ready for server storage
        createdAt: track.created_at,
      },
      storageInfo: {
        storageType,
        instantReady,
        serverStorageId: serverStorageIdResult,
        ipfsCid: ipfsCidResult,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Create track error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
