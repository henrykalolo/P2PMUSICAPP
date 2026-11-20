import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { createTrackStreamUrl } from '@/lib/media/signed-url';
import { combineSearchScore } from '@/lib/search';

export const runtime = 'nodejs';

function numberOrZero(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** GET /api/search?q=... - typo-tolerant track, artist and genre discovery. */
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get('q') || '').trim();
  if (!q) {
    return NextResponse.json({ success: true, query: '', tracks: [], users: [], genres: [] });
  }

  const requestedLimit = Number(request.nextUrl.searchParams.get('limit'));
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.floor(requestedLimit), 1), 50)
    : 20;

  try {
    const [tracksResult, usersResult, genresResult] = await Promise.all([
      query(
        `SELECT p.id, p.title, p.artist, p.album, p.genre, p.duration_seconds,
                p.cover_art_url, p.storage_type, p.server_storage_id, p.ipfs_cid,
                p.created_at, p.play_count,
                u.id AS author_id, u.username AS author_username, u.avatar_url AS author_avatar,
                (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS likes_count,
                (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comments_count
         FROM posts p
         JOIN users u ON u.id = p.author_id
         ORDER BY p.created_at DESC
         LIMIT 300`
      ),
      query(
        `SELECT u.id, u.username, u.avatar_url, u.artist_bio, u.artist_genres, u.is_artist,
                u.trust_score,
                (SELECT COUNT(*) FROM follows f WHERE f.following_id = u.id) AS followers_count,
                (SELECT COUNT(*) FROM posts p WHERE p.author_id = u.id) AS tracks_count
         FROM users u
         ORDER BY tracks_count DESC, u.created_at DESC
         LIMIT 200`
      ),
      query(
        `SELECT genre, COUNT(*)::int AS count
         FROM posts
         WHERE genre IS NOT NULL AND genre <> ''
         GROUP BY genre
         ORDER BY count DESC, genre ASC
         LIMIT 50`
      ),
    ]);

    const tracks = tracksResult.rows
      .map((row: Record<string, any>) => {
        const score = combineSearchScore(q, [row.title, row.artist, row.album, row.genre, row.author_username]);
        return {
          score,
          track: {
            id: row.id,
            title: row.title,
            artist: row.artist,
            album: row.album,
            genre: row.genre,
            duration: numberOrZero(row.duration_seconds),
            coverArtUrl: row.cover_art_url || null,
            streamUrl: createTrackStreamUrl(row.id, row.storage_type, row.server_storage_id, row.ipfs_cid),
            storageType: row.storage_type,
            serverStorageId: row.server_storage_id,
            ipfsCid: row.ipfs_cid,
            createdAt: row.created_at,
            playsCount: numberOrZero(row.play_count),
            likesCount: numberOrZero(row.likes_count),
            commentsCount: numberOrZero(row.comments_count),
            author: {
              id: row.author_id,
              username: row.author_username,
              avatarUrl: row.author_avatar || null,
            },
          },
        };
      })
      .filter((entry: { score: number }) => entry.score > 0)
      .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
      .slice(0, limit)
      .map((entry: { track: unknown }) => entry.track);

    const users = usersResult.rows
      .map((row: Record<string, any>) => {
        const score = combineSearchScore(q, [row.username, row.artist_bio, ...(row.artist_genres || [])]);
        return {
          score,
          user: {
            id: row.id,
            username: row.username,
            avatarUrl: row.avatar_url || null,
            bio: row.artist_bio || null,
            isArtist: Boolean(row.is_artist),
            trustScore: numberOrZero(row.trust_score),
            followersCount: numberOrZero(row.followers_count),
            tracksCount: numberOrZero(row.tracks_count),
          },
        };
      })
      .filter((entry: { score: number }) => entry.score > 0)
      .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
      .slice(0, limit)
      .map((entry: { user: unknown }) => entry.user);

    const genres = genresResult.rows
      .map((row: Record<string, any>) => ({
        name: String(row.genre),
        count: numberOrZero(row.count),
        score: combineSearchScore(q, [String(row.genre)]),
      }))
      .filter((row: { score: number }) => row.score > 0)
      .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
      .slice(0, 12)
      .map(({ name, count }: { name: string; count: number }) => ({ name, count }));

    return NextResponse.json({ success: true, query: q, tracks, users, genres });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
