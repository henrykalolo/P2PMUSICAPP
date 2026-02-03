import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth/jwt';
import { notifyFollow } from '@/lib/notifications/helper';

// POST /api/social/follow - Follow a user
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { userId: followingId } = body;

    if (!followingId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Prevent self-follow
    if (followingId === payload.userId) {
      return NextResponse.json(
        { error: 'Cannot follow yourself' },
        { status: 400 }
      );
    }

    // Check if user exists
    const userResult = await query(
      'SELECT id FROM users WHERE id = $1',
      [followingId]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Insert follow relationship
    await query(
      `INSERT INTO follows (follower_id, following_id) 
       VALUES ($1, $2) 
       ON CONFLICT (follower_id, following_id) DO NOTHING`,
      [payload.userId, followingId]
    );

    // Get follower info for notification
    const followerResult = await query(
      'SELECT username, avatar_url FROM users WHERE id = $1',
      [payload.userId]
    );
    const follower = followerResult.rows[0];

    // Send notification to the followed user
    await notifyFollow(followingId, follower.username, follower.avatar_url);

    // Update user's follows count
    const countResult = await query(
      'SELECT COUNT(*) FROM follows WHERE follower_id = $1',
      [payload.userId]
    );
    const count = parseInt(countResult.rows[0].count);

    await query(
      'UPDATE users SET users_followed_count = $1 WHERE id = $2',
      [count, payload.userId]
    );

    return NextResponse.json({
      success: true,
      followsCount: count,
    });
  } catch (error) {
    console.error('Follow error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/social/follow - Unfollow a user
export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const followingId = searchParams.get('userId');

    if (!followingId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Delete follow relationship
    await query(
      'DELETE FROM follows WHERE follower_id = $1 AND following_id = $2',
      [payload.userId, followingId]
    );

    // Update user's follows count
    const countResult = await query(
      'SELECT COUNT(*) FROM follows WHERE follower_id = $1',
      [payload.userId]
    );
    const count = parseInt(countResult.rows[0].count);

    await query(
      'UPDATE users SET users_followed_count = $1 WHERE id = $2',
      [count, payload.userId]
    );

    return NextResponse.json({
      success: true,
      followsCount: count,
    });
  } catch (error) {
    console.error('Unfollow error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
