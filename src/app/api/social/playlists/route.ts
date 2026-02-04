import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth/jwt';

// GET /api/social/playlists - Get user's playlists
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const includeTracks = searchParams.get('includeTracks') === 'true';

    let playlists;
    
    if (userId) {
      // Get specific user's playlists (public)
      const result = await query(`
        SELECT 
          p.id,
          p.name,
          p.description,
          p.is_public,
          p.created_at,
          p.updated_at,
          u.id as owner_id,
          u.username as owner_username,
          u.avatar_url as owner_avatar
        FROM playlists p
        JOIN users u ON p.user_id = u.id
        WHERE p.user_id = $1 AND p.is_public = true
        ORDER BY p.created_at DESC
      `, [userId]);
      playlists = result.rows;
    } else {
      // Get current user's playlists
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

      const result = await query(`
        SELECT 
          p.id,
          p.name,
          p.description,
          p.is_public,
          p.created_at,
          p.updated_at
        FROM playlists p
        WHERE p.user_id = $1
        ORDER BY p.created_at DESC
      `, [payload.userId]);
      playlists = result.rows;
    }

    // Optionally include tracks
    if (includeTracks && playlists.length > 0) {
      const playlistIds = playlists.map((p: any) => p.id);
      const tracksResult = await query(`
        SELECT 
          pt.playlist_id,
          pt.position,
          p.id as track_id,
          p.title,
          p.artist,
          p.album,
          p.genre,
          p.duration_seconds,
          p.cover_art_url,
          p.magnet_uri,
          p.ipfs_cid,
          t.author_id,
          t.username as author_username,
          t.avatar_url as author_avatar
        FROM playlist_tracks pt
        JOIN posts p ON pt.track_id = p.id
        JOIN users t ON p.author_id = t.id
        WHERE pt.playlist_id = ANY($1)
        ORDER BY pt.position ASC
      `, [playlistIds]);

      const tracksByPlaylist: Record<string, any[]> = {};
      tracksResult.rows.forEach((row: any) => {
        if (!tracksByPlaylist[row.playlist_id]) {
          tracksByPlaylist[row.playlist_id] = [];
        }
        tracksByPlaylist[row.playlist_id].push({
          id: row.track_id,
          title: row.title,
          artist: row.artist,
          album: row.album,
          genre: row.genre,
          duration: row.duration_seconds,
          coverArtUrl: row.cover_art_url,
          magnetUri: row.magnet_uri,
          ipfsCid: row.ipfs_cid,
          author: {
            id: row.author_id,
            username: row.author_username,
            avatarUrl: row.author_avatar,
          },
        });
      });

      playlists = playlists.map((playlist: any) => ({
        ...playlist,
        tracks: tracksByPlaylist[playlist.id] || [],
        tracksCount: (tracksByPlaylist[playlist.id] || []).length,
      }));
    }

    return NextResponse.json({
      success: true,
      playlists,
    });
  } catch (error) {
    console.error('Get playlists error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/social/playlists - Create a new playlist
export async function POST(request: NextRequest) {
  try {
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

    const { name, description, isPublic, trackIds } = await request.json();

    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'Playlist name is required' },
        { status: 400 }
      );
    }

    // Create playlist
    const result = await query(`
      INSERT INTO playlists (user_id, name, description, is_public)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, description, is_public, created_at, updated_at
    `, [payload.userId, name.trim(), description?.trim() || null, isPublic !== false]);

    const playlist = result.rows[0];

    // Add tracks if provided
    if (trackIds && Array.isArray(trackIds) && trackIds.length > 0) {
      const positions = trackIds.map((_, index) => index + 1);
      const playlistId = playlist.id;
      
      await query(`
        INSERT INTO playlist_tracks (playlist_id, track_id, position)
        SELECT $1, unnest($2::uuid[]), unnest($3::int[])
        ON CONFLICT (playlist_id, track_id) DO NOTHING
      `, [playlistId, trackIds, positions]);
    }

    return NextResponse.json({
      success: true,
      playlist: {
        ...playlist,
        tracks: [],
        tracksCount: 0,
      },
    });
  } catch (error) {
    console.error('Create playlist error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
