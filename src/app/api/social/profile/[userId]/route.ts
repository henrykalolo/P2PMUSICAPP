import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth/jwt';

// GET /api/social/profile/[userId] - Get user profile by ID
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ userId: string }> }
) {
  try {
    const params = await props.params;
    const { userId } = params;

    // Get token for optional authentication (to check if following)
    const authHeader = request.headers.get('authorization');
    let currentUserId: string | null = null;
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const payload = await verifyToken(token);
      if (payload) {
        currentUserId = payload.userId;
      }
    }

    // Fetch user profile
    const userResult = await query(
      `SELECT id, username, email, avatar_url, role, 
              is_artist, can_upload, onboarding_completed, is_founder_user,
              trust_score, badge, artist_bio, artist_genres, artist_verified,
              users_followed_count, created_at
       FROM users 
       WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const user = userResult.rows[0];

    // Fetch follower and following counts
    const [followersResult, followingResult, tracksResult, likesResult, repostsResult] = await Promise.all([
      query('SELECT COUNT(*) as count FROM follows WHERE following_id = $1', [userId]),
      query('SELECT COUNT(*) as count FROM follows WHERE follower_id = $1', [userId]),
      query('SELECT COUNT(*) as count FROM posts WHERE author_id = $1', [userId]),
      query('SELECT COUNT(*) as count FROM likes WHERE user_id = $1', [userId]),
      query('SELECT COUNT(*) as count FROM reposts WHERE user_id = $1', [userId])
    ]);

    // Check if current user is following this user and if this user follows back
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
        )
      ]);
      isFollowing = followResult.rows.length > 0;
      isFollowedBy = followedByResult.rows.length > 0;
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatar_url,
        role: user.role,
        isArtist: user.is_artist,
        canUpload: user.can_upload,
        onboardingCompleted: user.onboarding_completed,
        isFounderUser: user.is_founder_user,
        trustScore: user.trust_score,
        badge: user.badge,
        artistBio: user.artist_bio,
        artistGenres: user.artist_genres,
        artistVerified: user.artist_verified,
        followersCount: parseInt(followersResult.rows[0].count),
        followingCount: parseInt(followingResult.rows[0].count),
        tracksCount: parseInt(tracksResult.rows[0].count),
        likesCount: parseInt(likesResult.rows[0].count),
        repostsCount: parseInt(repostsResult.rows[0].count),
        createdAt: user.created_at,
        usersFollowedCount: user.users_followed_count
      },
      isFollowing,
      isFollowedBy
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
