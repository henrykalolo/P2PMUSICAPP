import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { createTrackStreamUrl } from '@/lib/media/signed-url';

export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** GET /api/tracks/:trackId - single track detail used by the post page. */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ trackId: string }> }
) {
  const { trackId } = await context.params;
  if (!UUID_RE.test(trackId)) {
    return NextResponse.json({ error: 'Invalid track id' }, { status: 400 });
  }

  try {
    const result = await query(
      `SELECT p.*, u.username AS author_username, u.avatar_url AS author_avatar,
              u.badge AS author_badge,
              (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS likes_count,
              (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comments_count,
              (SELECT COUNT(*) FROM reposts WHERE post_id = p.id) AS reposts_count
         FROM posts p
         JOIN users u ON p.author_id = u.id
        WHERE p.id = $1`,
      [trackId]
    );
    const row = result.rows[0] as Record<string, any> | undefined;
    if (!row) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    return NextResponse.json({
      track: {
        id: row.id,
        title: row.title,
        artist: row.artist,
        album: row.album,
        genre: row.genre,
        duration: row.duration_seconds,
        coverArtUrl: row.cover_art_url,
        storageType: row.storage_type,
        serverStorageId: row.server_storage_id,
        ipfsCid: row.ipfs_cid,
        streamUrl: createTrackStreamUrl(row.id, row.storage_type, row.server_storage_id, row.ipfs_cid),
        likesCount: Number(row.likes_count),
        commentsCount: Number(row.comments_count),
        repostsCount: Number(row.reposts_count),
        createdAt: row.created_at,
        author: {
          id: row.author_id,
          username: row.author_username,
          avatarUrl: row.author_avatar,
          badge: row.author_badge,
        },
      },
    });
  } catch (error) {
    console.error('Get track error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
