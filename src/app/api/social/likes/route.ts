import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth/jwt';

// GET /api/social/likes?userId=[userId] - Get user's liked tracks
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Get token for optional authentication
    const authHeader = request.headers.get('authorization');
    let currentUserId: string | null = null;
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const payload = await verifyToken(token);
      if (payload) {
        currentUserId = payload.userId;
      }
    }

    // Fetch liked tracks from database
    const likesResult = await query(`
      SELECT p.id, p.title, p.artist, p.album, p.genre, p.duration_seconds,
             p.magnet_uri, p.ipfs_cid, p.cover_art_url, p.created_at,
             u.id as author_id, u.username as author_username, u.avatar_url as author_avatar
      FROM likes l
      JOIN posts p ON l.post_id = p.id
      JOIN users u ON p.author_id = u.id
      WHERE l.user_id = $1
      ORDER BY l.created_at DESC
    `, [userId]);

    // Get likes and comments counts for each track
    const tracksWithCounts = await Promise.all(
      likesResult.rows.map(async (track: any) => {
        const [likesCountResult, commentsCountResult] = await Promise.all([
          query('SELECT COUNT(*) as count FROM likes WHERE post_id = $1', [track.id]),
          query('SELECT COUNT(*) as count FROM comments WHERE post_id = $1', [track.id])
        ]);

        // Check if current user has liked this track
        let userHasLiked = false;
        if (currentUserId) {
          const userLikeResult = await query(
            'SELECT 1 FROM likes WHERE user_id = $1 AND post_id = $2',
            [currentUserId, track.id]
          );
          userHasLiked = userLikeResult.rows.length > 0;
        }

        return {
          id: track.id,
          title: track.title,
          artist: track.artist,
          album: track.album,
          genre: track.genre,
          duration: track.duration_seconds,
          magnetUri: track.magnet_uri,
          ipfsCid: track.ipfs_cid,
          coverArtUrl: track.cover_art_url,
          createdAt: track.created_at,
          likesCount: parseInt(likesCountResult.rows[0].count),
          commentsCount: parseInt(commentsCountResult.rows[0].count),
          userHasLiked,
          author: {
            id: track.author_id,
            username: track.author_username,
            avatarUrl: track.author_avatar
          }
        };
      })
    );

    return NextResponse.json({
      success: true,
      tracks: tracksWithCounts
    });
  } catch (error) {
    console.error('Get likes error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
