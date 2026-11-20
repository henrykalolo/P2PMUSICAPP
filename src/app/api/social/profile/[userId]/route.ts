import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth/jwt';
import { getUserProfile } from '@/lib/profile';

// GET /api/social/profile/[userId] - Get user profile by ID
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await props.params;

    const authHeader = request.headers.get('authorization');
    let currentUserId: string | null = null;
    if (authHeader?.startsWith('Bearer ')) {
      const payload = await verifyToken(authHeader.slice(7));
      if (payload) currentUserId = payload.userId;
    }

    const user = await getUserProfile(userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let isFollowing = false;
    let isFollowedBy = false;
    if (currentUserId && currentUserId !== userId) {
      const [followResult, followedByResult] = await Promise.all([
        query(
          'SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2',
          [currentUserId, userId]
        ),
        query(
          'SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2',
          [userId, currentUserId]
        ),
      ]);
      isFollowing = followResult.rows.length > 0;
      isFollowedBy = followedByResult.rows.length > 0;
    }

    return NextResponse.json({ success: true, user, isFollowing, isFollowedBy });
  } catch (error) {
    console.error('Get user profile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
