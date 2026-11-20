import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth/jwt';
import { createTrackStreamUrl } from '@/lib/media/signed-url';
import {
  buildAutoPlaylistFallbackQuery,
  buildAutoPlaylistQuery,
} from '@/lib/playlists/auto-playlist-query';

interface AutoPlaylistBody {
  preferences?: unknown;
  includeFollowing?: unknown;
  randomize?: unknown;
  limit?: unknown;
}

/** POST /api/social/playlists/auto - Generate a personalized mix. */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyToken(authHeader.slice(7));
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as AutoPlaylistBody;
    const includeFollowing = body.includeFollowing !== false;
    const randomize = body.randomize !== false;
    const requestedLimit = Number(body.limit);
    const limit = Number.isFinite(requestedLimit) ? requestedLimit : 20;

    let userPreferences: string[] = [];
    if (Array.isArray(body.preferences)) {
      userPreferences = body.preferences
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .map((value) => value.trim());
    } else {
      const prefResult = await query(
        `SELECT preference_value FROM music_preferences
          WHERE user_id = $1 AND preference_type = 'genre'`,
        [payload.userId]
      );
      userPreferences = prefResult.rows
        .map((row: Record<string, unknown>) => String(row.preference_value || '').trim())
        .filter(Boolean);
    }

    let followingIds: string[] = [];
    if (includeFollowing) {
      const followingResult = await query(
        'SELECT following_id FROM follows WHERE follower_id = $1',
        [payload.userId]
      );
      followingIds = followingResult.rows
        .map((row: Record<string, unknown>) => String(row.following_id || ''))
        .filter(Boolean);
    }

    const primary = buildAutoPlaylistQuery({
      viewerId: payload.userId,
      preferences: userPreferences,
      followingIds,
      limit,
      randomize,
    });
    let result = await query(primary.sql, primary.params);

    if (result.rows.length === 0 && (userPreferences.length > 0 || followingIds.length > 0)) {
      const fallback = buildAutoPlaylistFallbackQuery(payload.userId, limit);
      result = await query(fallback.sql, fallback.params);
    }

    const tracks = result.rows.map((row: Record<string, any>) => ({
      id: row.id,
      title: row.title,
      artist: row.artist,
      album: row.album,
      genre: row.genre,
      duration: Number(row.duration_seconds) || 0,
      coverArtUrl: row.cover_art_url,
      ipfsCid: row.ipfs_cid,
      storageType: row.storage_type,
      serverStorageId: row.server_storage_id,
      streamUrl: createTrackStreamUrl(row.id, row.storage_type, row.server_storage_id, row.ipfs_cid),
      createdAt: row.created_at,
      likesCount: parseInt(row.likes_count, 10) || 0,
      commentsCount: parseInt(row.comments_count, 10) || 0,
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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
