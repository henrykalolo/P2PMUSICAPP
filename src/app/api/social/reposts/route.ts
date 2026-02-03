import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth/jwt';

// GET /api/social/reposts - Get reposts (with optional user and following filters)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const userId = searchParams.get('userId');
    const following = searchParams.get('following');
    
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

    let sql = `
      SELECT r.id, r.user_id, r.post_id, r.caption, r.created_at,
             u.id as reposter_id, u.username as reposter_username, u.avatar_url as reposter_avatar, u.badge as reposter_badge,
             p.id as original_post_id, p.title, p.artist, p.album, p.genre, p.duration_seconds,
             p.magnet_uri, p.ipfs_cid, p.cover_art_url, p.created_at as original_created_at,
             au.id as author_id, au.username as author_username, au.avatar_url as author_avatar, au.badge as author_badge
      FROM reposts r
      JOIN users u ON r.user_id = u.id
      JOIN posts p ON r.post_id = p.id
      JOIN users au ON p.author_id = au.id
    `;
    
    const params: any[] = [];
    let paramIndex = 1;

    if (userId) {
      sql += ` WHERE r.user_id = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    } else if (following === 'true' && currentUserId) {
      // Get reposts from followed users
      sql += ` WHERE r.user_id IN (
        SELECT following_id FROM follows WHERE follower_id = $${paramIndex}
      ) OR r.user_id = $${paramIndex}`;
      params.push(currentUserId);
      paramIndex++;
    }

    sql += ` ORDER BY r.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await query(sql, params);

    // Add additional counts
    const repostsWithCounts = await Promise.all(
      result.rows.map(async (row: any) => {
        const [likesCountResult, commentsCountResult, repostsCountResult] = await Promise.all([
          query('SELECT COUNT(*) as count FROM likes WHERE post_id = $1', [row.original_post_id]),
          query('SELECT COUNT(*) as count FROM comments WHERE post_id = $1', [row.original_post_id]),
          query('SELECT COUNT(*) as count FROM reposts WHERE post_id = $1', [row.original_post_id])
        ]);

        return {
          id: row.id,
          userId: row.reposter_id,
          postId: row.original_post_id,
          caption: row.caption,
          createdAt: row.created_at,
          reposter: {
            id: row.reposter_id,
            username: row.reposter_username,
            avatarUrl: row.reposter_avatar,
            badge: row.reposter_badge
          },
          originalPost: {
            id: row.original_post_id,
            title: row.title,
            artist: row.artist,
            album: row.album,
            genre: row.genre,
            duration: row.duration_seconds,
            magnetUri: row.magnet_uri,
            ipfsCid: row.ipfs_cid,
            coverArtUrl: row.cover_art_url,
            createdAt: row.original_created_at,
            likesCount: parseInt(likesCountResult.rows[0].count),
            commentsCount: parseInt(commentsCountResult.rows[0].count),
            repostsCount: parseInt(repostsCountResult.rows[0].count),
            author: {
              id: row.author_id,
              username: row.author_username,
              avatarUrl: row.author_avatar,
              badge: row.author_badge
            }
          }
        };
      })
    );

    return NextResponse.json({
      success: true,
      reposts: repostsWithCounts,
      pagination: {
        limit,
        offset,
        total: result.rowCount
      }
    });
  } catch (error) {
    console.error('Get reposts error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
