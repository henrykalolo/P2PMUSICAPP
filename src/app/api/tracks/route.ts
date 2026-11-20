import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth/jwt';
import { createTrackStreamUrl } from '@/lib/media/signed-url';
import { isAllowedImageUrl } from '@/lib/storage/public-url';
import {
  checkUserQuota,
  getStorageStats,
  storeOnServer,
  storeOnP2P,
  readEncryptionMeta,
  resolveServerFilePath,
  deleteFileUnified,
  FILE_TYPES,
  type ServerStorageResult,
  type P2PStorageResult,
} from '@/lib/storage/unifiedStorage';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    const requestedLimit = parseInt(searchParams.get('limit') || '20', 10);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 100)
      : 20;
    const requestedOffset = parseInt(searchParams.get('offset') || '0', 10);
    const offset = Number.isFinite(requestedOffset) && requestedOffset >= 0 ? requestedOffset : 0;
    const artist = searchParams.get('artist');
    const genre = searchParams.get('genre');
    const authorId = searchParams.get('authorId');
    const mode = searchParams.get('mode') || 'latest';

    const authHeader = request.headers.get('authorization');
    const viewerId = authHeader?.startsWith('Bearer ')
      ? (await verifyToken(authHeader.slice(7)))?.userId || null
      : null;

    if (mode === 'following' && !viewerId) {
      return NextResponse.json(
        { error: 'Sign in to see tracks from people you follow' },
        { status: 401 }
      );
    }

    let preferredGenres: string[] = [];
    if (mode === 'for-you' && viewerId) {
      const preferenceResult = await query(
        `SELECT preference_value FROM music_preferences
          WHERE user_id = $1 AND preference_type = 'genre'`,
        [viewerId]
      );
      preferredGenres = preferenceResult.rows
        .map((row: Record<string, any>) => String(row.preference_value || ''))
        .filter(Boolean);
    }

    let sql = `
      WITH filtered AS (
      SELECT
        p.id,
        p.title,
        p.artist,
        p.album,
        p.genre,
        p.year,
        p.duration_seconds as duration,
        p.ipfs_cid,
        p.ipfs_metadata_cid,
        p.ipfs_gateway_url,
        p.storage_type,
        p.server_storage_id,
        p.cover_art_url,
        p.description,
        p.album_id,
        p.play_count,
        p.share_count,
        p.file_size,
        p.mime_type,
        p.is_encrypted,
        p.encryption_iv,
        p.created_at,
        u.id as author_id,
        u.username as author_username,
        u.avatar_url as author_avatar,
        u.badge as author_badge,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
        (SELECT COUNT(*) FROM reposts WHERE post_id = p.id) as reposts_count,
        (SELECT COUNT(*) FROM play_events WHERE post_id = p.id AND event_type = 'complete') as completions_count
      FROM posts p
      JOIN users u ON p.author_id = u.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramIndex = 1;

    if (authorId) {
      sql += ` AND p.author_id = $${paramIndex}`;
      params.push(authorId);
      paramIndex++;
    }

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

    if (mode === 'following' && viewerId) {
      sql += ` AND EXISTS (
        SELECT 1 FROM follows f
         WHERE f.follower_id = $${paramIndex}::uuid AND f.following_id = p.author_id
      )`;
      params.push(viewerId);
      paramIndex++;
    }

    sql += `) SELECT * FROM filtered`;

    if (mode === 'for-you') {
      const viewerParam = `$${paramIndex}`;
      const genreParam = `$${paramIndex + 1}`;
      params.push(viewerId, preferredGenres);
      paramIndex += 2;
      sql += ` ORDER BY (
          COALESCE(likes_count, 0) * 2 +
          COALESCE(reposts_count, 0) * 3 +
          COALESCE(comments_count, 0) +
          COALESCE(play_count, 0) * 0.5 +
          COALESCE(completions_count, 0) * 2 +
          CASE WHEN ${viewerParam}::uuid IS NOT NULL AND author_id = ${viewerParam}::uuid THEN 1 ELSE 0 END +
          CASE WHEN ${viewerParam}::uuid IS NOT NULL AND EXISTS (
            SELECT 1 FROM follows f
             WHERE f.follower_id = ${viewerParam}::uuid AND f.following_id = author_id
          ) THEN 8 ELSE 0 END +
          CASE WHEN ${genreParam}::text[] <> '{}' AND COALESCE(genre, '') = ANY(${genreParam}::text[]) THEN 4 ELSE 0 END +
          CASE WHEN ${viewerParam}::uuid IS NOT NULL AND EXISTS (
            SELECT 1 FROM likes l
             WHERE l.user_id = ${viewerParam}::uuid AND l.post_id = id
          ) THEN 2 ELSE 0 END -
          LEAST(EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400.0 * 0.15, 20)
        ) DESC, created_at DESC`;
    } else {
      sql += ` ORDER BY created_at DESC`;
    }

    sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await query(sql, params);

    return NextResponse.json({
      success: true,
      tracks: result.rows.map((row: Record<string, any>) => ({
        id: row.id,
        title: row.title,
        artist: row.artist,
        album: row.album,
        albumId: row.album_id,
        genre: row.genre,
        year: row.year,
        duration: row.duration,
        ipfsCid: row.ipfs_cid,
        ipfsMetadataCid: row.ipfs_metadata_cid,
        ipfsGatewayUrl: row.ipfs_gateway_url,
        storageType: row.storage_type,
        serverStorageId: row.server_storage_id,
        coverArtUrl: row.cover_art_url,
        description: row.description,
        fileSize: row.file_size,
        mimeType: row.mime_type,
        streamUrl: createTrackStreamUrl(row.id, row.storage_type, row.server_storage_id, row.ipfs_cid),
        isEncrypted: row.is_encrypted,
        createdAt: row.created_at,
        instantReady: row.storage_type === 'server',
        author: {
          id: row.author_id,
          username: row.author_username,
          avatarUrl: row.author_avatar,
          badge: row.author_badge,
        },
        likesCount: parseInt(row.likes_count),
        commentsCount: parseInt(row.comments_count),
        repostsCount: parseInt(row.reposts_count),
        playsCount: parseInt(row.play_count) || 0,
        sharesCount: parseInt(row.share_count) || 0,
      })),
      pagination: {
        limit,
        offset,
        total: result.rowCount,
        mode,
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
  let serverStorageIdForCleanup: string | null = null;
  let authenticatedUserId: string | null = null;
  let trackInserted = false;

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
    authenticatedUserId = payload.userId;

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
    const coverArtUrl = formData.get('coverArtUrl') as string | null;
    const description = (formData.get('description') as string | null)?.trim() || null;
    const albumIdRaw = formData.get('albumId') as string | null;

    // Metadata-only mode (file already uploaded via /api/storage)
    const metadataOnly = formData.get('metadataOnly') === 'true';
    const serverStorageId = formData.get('serverStorageId') as string;
    const ipfsCid = formData.get('ipfsCid') as string;

    if (!title || title.trim().length === 0) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    if (title.trim().length > 200) {
      return NextResponse.json({ error: 'Title is too long' }, { status: 400 });
    }
    if (description && description.length > 1000) {
      return NextResponse.json({ error: 'Description is too long' }, { status: 400 });
    }
    if (coverArtUrl && !isAllowedImageUrl(coverArtUrl)) {
      return NextResponse.json({ error: 'Invalid cover art URL' }, { status: 400 });
    }

    let albumId: string | null = null;
    if (albumIdRaw) {
      if (!UUID_RE.test(albumIdRaw)) {
        return NextResponse.json({ error: 'Invalid album id' }, { status: 400 });
      }
      const albumCheck = await query('SELECT id FROM albums WHERE id = $1 AND owner_id = $2', [
        albumIdRaw,
        payload.userId,
      ]);
      if (albumCheck.rows.length === 0) {
        return NextResponse.json({ error: 'Album not found' }, { status: 404 });
      }
      albumId = albumIdRaw;
    }
    if (year !== undefined && (!Number.isFinite(year) || year < 1900 || year > new Date().getFullYear() + 1)) {
      return NextResponse.json({ error: 'Invalid release year' }, { status: 400 });
    }
    if (duration !== undefined && (!Number.isFinite(duration) || duration < 0 || duration > 86400)) {
      return NextResponse.json({ error: 'Invalid duration' }, { status: 400 });
    }

    if ((!file || metadataOnly) && !serverStorageId && !ipfsCid) {
      return NextResponse.json(
        { error: 'A file, serverStorageId, or ipfsCid is required' },
        { status: 400 }
      );
    }

    if (ipfsCid) {
      const existing = await query('SELECT id FROM posts WHERE ipfs_cid = $1', [ipfsCid]);
      if (existing.rows.length > 0) {
        return NextResponse.json({ error: 'Track with this CID already exists' }, { status: 409 });
      }
    }

    let storageType: 'server' | 'ipfs' | 'hybrid' = 'server';
    let serverStorageIdResult: string | null = null;
    let ipfsCidResult: string | null = null;
    let ipfsGatewayUrl: string | null = null;
    let fileSize = 0;
    let mimeType = 'audio/mpeg';
    let instantReady = true;
    let encryptionIv: string | null = null;
    let isEncrypted = false;

    // If file is provided directly, upload using unified storage
    if (file && !metadataOnly) {
      const audioConfig = FILE_TYPES.audio;
      const extension = file.name.includes('.')
        ? `.${file.name.split('.').pop()?.toLowerCase()}`
        : '';
      const validAudioType =
        audioConfig.allowedTypes.includes(file.type) ||
        (file.type.startsWith('audio/') && audioConfig.extensions.includes(extension));
      if (!validAudioType) {
        return NextResponse.json(
          { error: 'Invalid audio file type' },
          { status: 400 }
        );
      }
      if (file.size > audioConfig.maxSize) {
        return NextResponse.json(
          { error: 'File too large. Maximum size is 100MB' },
          { status: 400 }
        );
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
        encryptionIv = serverResult.encryptionIv || null;
        isEncrypted = Boolean(serverResult.isEncrypted);
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
      try {
        resolveServerFilePath(payload.userId, serverStorageId, 'audio');
      } catch {
        return NextResponse.json({ error: 'Uploaded file not found' }, { status: 404 });
      }
      serverStorageIdResult = serverStorageId;
      instantReady = true;
      const meta = await readEncryptionMeta(payload.userId, serverStorageId, 'audio');
      encryptionIv = meta?.iv || null;
      isEncrypted = Boolean(meta);
    } else if (ipfsCid) {
      // Using IPFS storage
      storageType = 'ipfs';
      ipfsCidResult = ipfsCid;
      ipfsGatewayUrl = `https://ipfs.io/ipfs/${ipfsCid}`;
      instantReady = false;
    }

    serverStorageIdForCleanup = serverStorageIdResult;

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
        cover_art_url,
        description,
        album_id,
        is_encrypted,
        encryption_iv
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *`,
      [
        payload.userId,
        title.trim(),
        artist?.trim() || 'Unknown Artist',
        album?.trim() || 'Unknown Album',
        genre?.trim() || '',
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
        description,
        albumId,
        isEncrypted,
        encryptionIv ? Buffer.from(encryptionIv, 'hex') : null,
      ]
    );

    // Update user's upload tracking
    await query(
      'UPDATE users SET updated_at = NOW() WHERE id = $1',
      [payload.userId]
    );

    trackInserted = true;
    const track = result.rows[0];

    return NextResponse.json({
      success: true,
      track: {
        id: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album,
        albumId: track.album_id,
        genre: track.genre,
        year: track.year,
        duration: track.duration_seconds,
        storageType: track.storage_type,
        serverStorageId: track.server_storage_id,
        ipfsCid: track.ipfs_cid,
        ipfsGatewayUrl: track.ipfs_gateway_url,
        fileSize: track.file_size,
        mimeType: track.mime_type,
        streamUrl: createTrackStreamUrl(track.id, track.storage_type, track.server_storage_id, track.ipfs_cid),
        isEncrypted: track.is_encrypted,
        coverArtUrl: track.cover_art_url,
        description: track.description,
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
    if (!trackInserted && serverStorageIdForCleanup && authenticatedUserId) {
      try {
        await deleteFileUnified(
          authenticatedUserId,
          'server',
          serverStorageIdForCleanup,
          'audio'
        );
      } catch (cleanupError) {
        console.warn('Could not remove orphaned upload', cleanupError);
      }
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
