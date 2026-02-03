import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth/jwt';

// GET /api/social/following - Get users that the current user is following
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

    // Get following users
    const result = await query(`
      SELECT u.id, u.username, u.avatar_url, u.trust_score, u.badge, u.is_artist
      FROM follows f
      JOIN users u ON f.following_id = u.id
      WHERE f.follower_id = $1
      ORDER BY f.created_at DESC
    `, [payload.userId]);

    return NextResponse.json({
      success: true,
      users: result.rows.map(user => ({
        id: user.id,
        username: user.username,
        avatarUrl: user.avatar_url,
        trustScore: user.trust_score,
        badge: user.badge,
        isArtist: user.is_artist
      }))
    });
  } catch (error) {
    console.error('Get following error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
