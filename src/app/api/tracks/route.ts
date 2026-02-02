import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth/jwt';

// GET /api/tracks - Get all tracks
export async function GET(request: NextRequest) {
  try {
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
        p.cover_art_url,
        p.file_size,
        p.mime_type,
        p.created_at,
        u.id as author_id,
        u.username as author_username,
        u.avatar_url as author_avatar,
        u.badge as author_badge,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count
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
      tracks: result.rows,
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

// POST /api/tracks - Create a new track
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
    const {
      title,
      artist,
      album,
      genre,
      year,
      duration,
      ipfsCid,
      metadataCid,
      fileSize,
      mimeType,
    } = body;

    // Validate required fields
    if (!title || !ipfsCid) {
      return NextResponse.json(
        { error: 'Title and IPFS CID are required' },
        { status: 400 }
      );
    }

    // Validate IPFS CID format (should be base58 or base32 encoded)
    if (ipfsCid.length < 46 || ipfsCid.length > 128) {
      return NextResponse.json(
        { error: 'Invalid IPFS CID format' },
        { status: 400 }
      );
    }

    // Check if user can upload
    const userResult = await query(
      'SELECT can_upload, daily_upload_quota, total_upload_quota FROM users WHERE id = $1',
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

    // Check for duplicate CID
    const existingResult = await query(
      'SELECT id FROM posts WHERE ipfs_cid = $1',
      [ipfsCid]
    );

    if (existingResult.rows.length > 0) {
      return NextResponse.json(
        { error: 'Track with this CID already exists' },
        { status: 409 }
      );
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
        file_size,
        mime_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        payload.userId,
        title,
        artist || 'Unknown Artist',
        album || 'Unknown Album',
        genre || '',
        year || new Date().getFullYear(),
        duration || 0,
        ipfsCid,
        metadataCid || null,
        `https://ipfs.io/ipfs/${ipfsCid}`,
        'ipfs',
        fileSize || 0,
        mimeType || 'audio/mpeg',
      ]
    );

    // Update user's upload quota tracking (simplified - in production, track actual usage)
    await query(
      'UPDATE users SET updated_at = NOW() WHERE id = $1',
      [payload.userId]
    );

    return NextResponse.json({
      success: true,
      track: result.rows[0],
    }, { status: 201 });
  } catch (error) {
    console.error('Create track error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
