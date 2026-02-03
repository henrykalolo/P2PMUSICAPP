import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth/jwt';

// GET /api/social/trends - Get social interaction trends
export async function GET(request: NextRequest) {
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

    // Get trending artists (most followed)
    const trendingArtistsResult = await query(`
      SELECT u.id, u.username, u.avatar_url, u.trust_score, u.badge,
             COUNT(f.following_id) as followers_count
      FROM users u
      LEFT JOIN follows f ON u.id = f.following_id
      WHERE u.is_artist = TRUE
      GROUP BY u.id
      ORDER BY followers_count DESC
      LIMIT 5
    `);

    // Get popular tracks (most liked)
    const popularTracksResult = await query(`
      SELECT p.id, p.title, p.artist, p.album, p.genre, p.cover_art_url,
             COUNT(l.user_id) as likes_count,
             u.username as author_username,
             u.avatar_url as author_avatar
      FROM posts p
      JOIN users u ON p.author_id = u.id
      LEFT JOIN likes l ON p.id = l.post_id
      GROUP BY p.id, u.username, u.avatar_url
      ORDER BY likes_count DESC
      LIMIT 5
    `);

    // Get recent comments from followed users
    const recentCommentsResult = await query(`
      SELECT c.id, c.content, c.created_at,
             u.username as author_username,
             u.avatar_url as author_avatar,
             p.title as post_title,
             p.id as post_id
      FROM comments c
      JOIN users u ON c.user_id = u.id
      JOIN posts p ON c.post_id = p.id
      JOIN follows f ON c.user_id = f.following_id
      WHERE f.follower_id = $1
      ORDER BY c.created_at DESC
      LIMIT 5
    `, [payload.userId]);

    return NextResponse.json({
      success: true,
      trends: {
        trendingArtists: trendingArtistsResult.rows.map(artist => ({
          id: artist.id,
          username: artist.username,
          avatarUrl: artist.avatar_url,
          trustScore: artist.trust_score,
          badge: artist.badge,
          followersCount: parseInt(artist.followers_count)
        })),
        popularTracks: popularTracksResult.rows.map(track => ({
          id: track.id,
          title: track.title,
          artist: track.artist,
          album: track.album,
          genre: track.genre,
          coverArtUrl: track.cover_art_url,
          likesCount: parseInt(track.likes_count),
          author: {
            username: track.author_username,
            avatarUrl: track.author_avatar
          }
        })),
        recentComments: recentCommentsResult.rows.map(comment => ({
          id: comment.id,
          content: comment.content,
          createdAt: comment.created_at,
          author: {
            username: comment.author_username,
            avatarUrl: comment.author_avatar
          },
          post: {
            id: comment.post_id,
            title: comment.post_title
          }
        }))
      }
    });
  } catch (error) {
    console.error('Get trends error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
