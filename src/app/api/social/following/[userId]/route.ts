import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth/jwt';

// GET /api/social/following/[userId] - Get users that a user is following
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const unwrappedParams = await params;
    const userId = unwrappedParams.userId;

    // Get current user's ID for follow status
    const authHeader = request.headers.get('authorization');
    let currentUserId: string | null = null;
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const payload = await verifyToken(token);
      if (payload) {
        currentUserId = payload.userId;
      }
    }

    // Get following with their info
    const result = await query(`
      SELECT DISTINCT
        u.id,
        u.username,
        u.avatar_url,
        u.trust_score,
        u.is_artist,
        u.badge,
        CASE WHEN f2.following_id IS NOT NULL THEN true ELSE false END as is_following,
        CASE WHEN f.follower_id IS NOT NULL THEN true ELSE false END as is_followed_by
      FROM follows f
      JOIN users u ON f.following_id = u.id
      LEFT JOIN follows f2 ON f2.follower_id = u.id AND f2.following_id = $1
      WHERE f.follower_id = $2
      ORDER BY f.created_at DESC
    `, [currentUserId, userId]);

    const following = result.rows.map((row: any) => ({
      id: row.id,
      username: row.username,
      avatarUrl: row.avatar_url,
      trustScore: row.trust_score,
      isArtist: row.is_artist,
      badge: row.badge,
      isFollowing: currentUserId ? row.is_following : false,
      isFollowedBy: currentUserId ? row.is_followed_by : false,
    }));

    return NextResponse.json({
      success: true,
      users: following,
      count: following.length,
    });
  } catch (error) {
    console.error('Get following error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
