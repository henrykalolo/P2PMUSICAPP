import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth/jwt';

// GET /api/admin/users - Get user management data
export async function GET(request: NextRequest) {
  try {
    // Verify admin access
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

    // Check if user is superadmin
    const userResult = await query(
      'SELECT is_superadmin FROM users WHERE id = $1',
      [payload.userId]
    );

    if (userResult.rows.length === 0 || !userResult.rows[0].is_superadmin) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // Get recent user registrations (last 30 days)
    const recentUsersResult = await query(`
      SELECT 
        u.id,
        u.username,
        u.email,
        u.avatar_url,
        u.badge,
        u.trust_score,
        u.is_artist,
        u.can_upload,
        u.onboarding_completed,
        u.is_founder_user,
        u.created_at,
        COALESCE(us.total_uploaded, 0) as total_uploaded,
        COALESCE(us.upload_ratio, 0) as upload_ratio
      FROM users u
      LEFT JOIN user_stats us ON u.id = us.user_id
      WHERE u.created_at >= NOW() - INTERVAL '30 days'
      ORDER BY u.created_at DESC
      LIMIT 20
    `);

    // Get users with badges
    const usersWithBadgesResult = await query(`
      SELECT 
        u.id,
        u.username,
        u.email,
        u.avatar_url,
        u.badge,
        u.trust_score,
        u.is_artist,
        u.created_at,
        COALESCE(us.total_uploaded, 0) as total_uploaded,
        COALESCE(us.upload_ratio, 0) as upload_ratio,
        (SELECT COUNT(*) FROM posts WHERE author_id = u.id) as track_count
      FROM users u
      LEFT JOIN user_stats us ON u.id = us.user_id
      WHERE u.badge IS NOT NULL AND u.badge != 'Newbie'
      ORDER BY u.trust_score DESC
      LIMIT 20
    `);

    // Get top contributors (users with most uploads and best ratios)
    const topContributorsResult = await query(`
      SELECT 
        u.id,
        u.username,
        u.email,
        u.avatar_url,
        u.badge,
        u.trust_score,
        u.created_at,
        COALESCE(us.total_uploaded, 0) as total_uploaded,
        COALESCE(us.total_downloaded, 0) as total_downloaded,
        COALESCE(us.upload_ratio, 0) as upload_ratio,
        COALESCE(us.session_count, 0) as session_count,
        (SELECT COUNT(*) FROM posts WHERE author_id = u.id) as track_count,
        (SELECT COUNT(*) FROM likes l JOIN posts p ON l.post_id = p.id WHERE p.author_id = u.id) as total_likes_received
      FROM users u
      LEFT JOIN user_stats us ON u.id = us.user_id
      WHERE us.total_uploaded > 0
      ORDER BY us.upload_ratio DESC, us.total_uploaded DESC
      LIMIT 20
    `);

    // Get user statistics
    const userStatsResult = await query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as new_this_week,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as new_this_month,
        COUNT(*) FILTER (WHERE onboarding_completed = true) as completed_onboarding,
        COUNT(*) FILTER (WHERE is_artist = true) as artists,
        COUNT(*) FILTER (WHERE can_upload = true) as can_upload_count,
        COUNT(*) FILTER (WHERE badge IS NOT NULL AND badge != 'Newbie') as badged_users
      FROM users
    `);

    // Get recent uploads for content moderation
    const recentUploadsResult = await query(`
      SELECT 
        p.id,
        p.title,
        p.artist,
        p.album,
        p.genre,
        p.storage_type,
        p.created_at,
        u.id as author_id,
        u.username as author_username,
        u.avatar_url as author_avatar,
        u.trust_score as author_trust_score,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count,
        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comment_count
      FROM posts p
      JOIN users u ON p.author_id = u.id
      ORDER BY p.created_at DESC
      LIMIT 30
    `);

    // Get potentially flagged content (low trust score users or suspicious patterns)
    // In a real implementation, this would check a flags table
    const flaggedContentResult = await query(`
      SELECT 
        p.id,
        p.title,
        p.artist,
        p.genre,
        p.storage_type,
        p.created_at,
        u.id as author_id,
        u.username as author_username,
        u.avatar_url as author_avatar,
        u.trust_score as author_trust_score,
        u.badge as author_badge,
        (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as like_count
      FROM posts p
      JOIN users u ON p.author_id = u.id
      WHERE u.trust_score < 10
        AND p.created_at >= NOW() - INTERVAL '7 days'
      ORDER BY p.created_at DESC
      LIMIT 20
    `);

    return NextResponse.json({
      success: true,
      users: {
        recentRegistrations: recentUsersResult.rows.map((row: Record<string, unknown>) => ({
          id: row.id,
          username: row.username,
          email: row.email,
          avatarUrl: row.avatar_url,
          badge: row.badge,
          trustScore: row.trust_score,
          isArtist: row.is_artist,
          canUpload: row.can_upload,
          onboardingCompleted: row.onboarding_completed,
          isFounderUser: row.is_founder_user,
          createdAt: row.created_at,
          totalUploaded: row.total_uploaded,
          uploadRatio: row.upload_ratio,
        })),
        withBadges: usersWithBadgesResult.rows.map((row: Record<string, unknown>) => ({
          id: row.id,
          username: row.username,
          email: row.email,
          avatarUrl: row.avatar_url,
          badge: row.badge,
          trustScore: row.trust_score,
          isArtist: row.is_artist,
          createdAt: row.created_at,
          totalUploaded: row.total_uploaded,
          uploadRatio: row.upload_ratio,
          trackCount: parseInt(row.track_count as string),
        })),
        topContributors: topContributorsResult.rows.map((row: Record<string, unknown>) => ({
          id: row.id,
          username: row.username,
          email: row.email,
          avatarUrl: row.avatar_url,
          badge: row.badge,
          trustScore: row.trust_score,
          createdAt: row.created_at,
          totalUploaded: row.total_uploaded,
          totalDownloaded: row.total_downloaded,
          uploadRatio: row.upload_ratio,
          sessionCount: row.session_count,
          trackCount: parseInt(row.track_count as string),
          totalLikesReceived: parseInt(row.total_likes_received as string),
        })),
        statistics: {
          totalUsers: parseInt(userStatsResult.rows[0].total_users),
          newThisWeek: parseInt(userStatsResult.rows[0].new_this_week),
          newThisMonth: parseInt(userStatsResult.rows[0].new_this_month),
          completedOnboarding: parseInt(userStatsResult.rows[0].completed_onboarding),
          artists: parseInt(userStatsResult.rows[0].artists),
          canUpload: parseInt(userStatsResult.rows[0].can_upload_count),
          badgedUsers: parseInt(userStatsResult.rows[0].badged_users),
        },
      },
      content: {
        recentUploads: recentUploadsResult.rows.map((row: Record<string, unknown>) => ({
          id: row.id,
          title: row.title,
          artist: row.artist,
          album: row.album,
          genre: row.genre,
          storageType: row.storage_type,
          createdAt: row.created_at,
          author: {
            id: row.author_id,
            username: row.author_username,
            avatarUrl: row.author_avatar,
            trustScore: row.author_trust_score,
          },
          likeCount: parseInt(row.like_count as string),
          commentCount: parseInt(row.comment_count as string),
        })),
        flaggedContent: flaggedContentResult.rows.map((row: Record<string, unknown>) => ({
          id: row.id,
          title: row.title,
          artist: row.artist,
          genre: row.genre,
          storageType: row.storage_type,
          createdAt: row.created_at,
          author: {
            id: row.author_id,
            username: row.author_username,
            avatarUrl: row.author_avatar,
            trustScore: row.author_trust_score,
            badge: row.author_badge,
          },
          likeCount: parseInt(row.like_count as string),
          flagReason: 'Low trust score user',
          severity: (row.author_trust_score as number) < 5 ? 'high' : 'medium',
        })),
      },
    });
  } catch (error) {
    console.error('Admin users error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
