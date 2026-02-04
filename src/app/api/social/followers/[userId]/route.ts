import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth/jwt';

// GET /api/social/followers/[userId] - Get followers of a user
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

    // Get followers with their info
    const result = await query(`
      SELECT DISTINCT
        u.id,
        u.username,
        u.avatar_url,
        u.trust_score,
        u.is_artist,
        u.badge,
        CASE WHEN f.follower_id IS NOT NULL THEN true ELSE false END as is_following,
        CASE WHEN f2.follower_id IS NOT NULL THEN true ELSE false END as is_followed_by
      FROM follows f
      JOIN users u ON f.follower_id = u.id
      LEFT JOIN follows f2 ON f2.following_id = u.id AND f2.follower_id = $1
      WHERE f.following_id = $2
      ORDER BY f.created_at DESC
    `, [currentUserId, userId]);

    const followers = result.rows.map((row: any) => ({
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
      users: followers,
      count: followers.length,
    });
  } catch (error) {
    console.error('Get followers error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
