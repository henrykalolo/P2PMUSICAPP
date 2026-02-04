import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth/jwt';

// POST /api/social/playlists/auto - Generate auto-playlist based on preferences
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

    const { preferences, includeFollowing = true, randomize = true, limit = 20 } = await request.json();

    // Get user's music preferences
    let userPreferences: string[] = [];
    if (preferences && Array.isArray(preferences)) {
      userPreferences = preferences;
    } else {
      const prefResult = await query(
        'SELECT preference_value FROM music_preferences WHERE user_id = $1',
        [payload.userId]
      );
      userPreferences = prefResult.rows.map((row: any) => row.preference_value);
    }

    // Get users the current user follows
    let followingIds: string[] = [];
    if (includeFollowing) {
      const followingResult = await query(
        'SELECT following_id FROM follows WHERE follower_id = $1',
        [payload.userId]
      );
      followingIds = followingResult.rows.map((row: any) => row.following_id);
    }

    // Build query for auto-generated playlist
    let queryText = `
      SELECT DISTINCT
        p.id,
        p.title,
        p.artist,
        p.album,
        p.genre,
        p.duration_seconds,
        p.cover_art_url,
        p.magnet_uri,
        p.ipfs_cid,
        p.created_at,
        u.id as author_id,
        u.username as author_username,
        u.avatar_url as author_avatar,
        COUNT(DISTINCT l.id) as likes_count,
        COUNT(DISTINCT c.id) as comments_count
      FROM posts p
      JOIN users u ON p.author_id = u.id
      LEFT JOIN likes l ON p.id = l.post_id
      LEFT JOIN comments c ON p.id = c.post_id
      WHERE 1=1
    `;

    const queryParams: any[] = [];
    let paramIndex = 1;

    // Filter by preferences if available
    if (userPreferences.length > 0) {
      queryText += ` AND p.genre = ANY($${paramIndex++})`;
      queryParams.push(userPreferences);
    }

    // Include tracks from followed users
    if (followingIds.length > 0) {
      queryText += ` AND p.author_id = ANY($${paramIndex++})`;
      queryParams.push(followingIds);
    }

    // Exclude user's own posts (discover new content)
    queryText += ` AND p.author_id != $${paramIndex++}`;
    queryParams.push(payload.userId);

    queryText += `
      GROUP BY p.id, p.title, p.artist, p.album, p.genre, p.duration_seconds,
               p.cover_art_url, p.magnet_uri, p.ipfs_cid, p.created_at,
               u.id, u.username, u.avatar_url
    `;

    // Order by recency or randomly
    if (randomize) {
      queryText += ` ORDER BY RANDOM()`;
    } else {
      queryText += ` ORDER BY p.created_at DESC`;
    }

    queryText += ` LIMIT $${paramIndex}`;
    queryParams.push(limit);

    const result = await query(queryText, queryParams);

    const tracks = result.rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      artist: row.artist,
      album: row.album,
      genre: row.genre,
      duration: row.duration_seconds,
      coverArtUrl: row.cover_art_url,
      magnetUri: row.magnet_uri,
      ipfsCid: row.ipfs_cid,
      createdAt: row.created_at,
      likesCount: parseInt(row.likes_count),
      commentsCount: parseInt(row.comments_count),
      author: {
        id: row.author_id,
        username: row.author_username,
        avatarUrl: row.author_avatar,
      },
    }));

    return NextResponse.json({
      success: true,
      playlist: {
        name: 'Discover Mix',
        description: 'A personalized mix based on your preferences and followed artists',
        tracks,
        tracksCount: tracks.length,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Auto playlist error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
