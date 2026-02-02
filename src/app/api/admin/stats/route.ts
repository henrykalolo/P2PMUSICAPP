import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth/jwt';

// GET /api/admin/stats - Get platform statistics
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

    // Get total tracks
    const tracksResult = await query('SELECT COUNT(*) as count FROM posts');
    const totalTracks = parseInt(tracksResult.rows[0].count);

    // Get total users
    const usersResult = await query('SELECT COUNT(*) as count FROM users');
    const totalUsers = parseInt(usersResult.rows[0].count);

    // Get total likes
    const likesResult = await query('SELECT COUNT(*) as count FROM likes');
    const totalLikes = parseInt(likesResult.rows[0].count);

    // Get total comments
    const commentsResult = await query('SELECT COUNT(*) as count FROM comments');
    const totalComments = parseInt(commentsResult.rows[0].count);

    // Get most active genres
    const genresResult = await query(`
      SELECT genre, COUNT(*) as count 
      FROM posts 
      WHERE genre IS NOT NULL AND genre != ''
      GROUP BY genre 
      ORDER BY count DESC 
      LIMIT 10
    `);

    // Get storage type distribution
    const storageResult = await query(`
      SELECT storage_type, COUNT(*) as count 
      FROM posts 
      GROUP BY storage_type
    `);

    // Get recent activity (last 7 days)
    const recentTracksResult = await query(`
      SELECT COUNT(*) as count 
      FROM posts 
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `);

    const recentUsersResult = await query(`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `);

    // Get uploads per day for the last 30 days
    const uploadsPerDayResult = await query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM posts
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `);

    // Get swarm health metrics
    const swarmHealthResult = await query(`
      SELECT 
        COUNT(DISTINCT p.id) as total_torrents,
        COUNT(DISTINCT CASE WHEN p.storage_type IN ('torrent', 'hybrid') THEN p.id END) as torrent_tracks,
        COUNT(DISTINCT CASE WHEN p.storage_type = 'ipfs' THEN p.id END) as ipfs_tracks,
        COUNT(DISTINCT CASE WHEN l.user_id IS NOT NULL THEN p.id END) as seeded_tracks,
        SUM(p.file_size) as total_storage_bytes
      FROM posts p
      LEFT JOIN likes l ON p.id = l.post_id
    `);

    // Get trust score distribution
    const trustDistributionResult = await query(`
      SELECT 
        COUNT(CASE WHEN trust_score <= 20 THEN 1 END) as leechers,
        COUNT(CASE WHEN trust_score > 20 AND trust_score <= 60 THEN 1 END) as nodes,
        COUNT(CASE WHEN trust_score > 60 AND trust_score <= 90 THEN 1 END) as guardians,
        COUNT(CASE WHEN trust_score > 90 THEN 1 END) as archivists
      FROM users
    `);

    // Get peer count distribution
    const peerDistributionResult = await query(`
      SELECT 
        COUNT(CASE WHEN trust_score <= 20 THEN 1 END) as ephemeral_peers,
        COUNT(CASE WHEN trust_score > 20 AND trust_score <= 60 THEN 1 END) as mutual_peers,
        COUNT(CASE WHEN trust_score > 60 THEN 1 END) as guardian_peers
      FROM users
    `);

    return NextResponse.json({
      success: true,
      stats: {
        totalTracks,
        totalUsers,
        totalLikes,
        totalComments,
        recentActivity: {
          tracksLast7Days: parseInt(recentTracksResult.rows[0].count),
          usersLast7Days: parseInt(recentUsersResult.rows[0].count),
        },
        genres: genresResult.rows.map((row: { genre: string; count: string }) => ({
          name: row.genre,
          count: parseInt(row.count),
        })),
        storageDistribution: storageResult.rows.map((row: { storage_type: string; count: string }) => ({
          type: row.storage_type,
          count: parseInt(row.count),
        })),
        uploadsPerDay: uploadsPerDayResult.rows.map((row: { date: string; count: string }) => ({
          date: row.date,
          count: parseInt(row.count),
        })),
        swarmHealth: {
          totalTorrents: parseInt(swarmHealthResult.rows[0].total_torrents),
          torrentTracks: parseInt(swarmHealthResult.rows[0].torrent_tracks),
          ipfsTracks: parseInt(swarmHealthResult.rows[0].ipfs_tracks),
          seededTracks: parseInt(swarmHealthResult.rows[0].seeded_tracks),
          totalStorageBytes: parseInt(swarmHealthResult.rows[0].total_storage_bytes || '0'),
          healthyPercentage: totalTracks > 0 
            ? Math.round((parseInt(swarmHealthResult.rows[0].seeded_tracks) / totalTracks) * 100)
            : 0,
          status: totalTracks > 0 && (parseInt(swarmHealthResult.rows[0].seeded_tracks) / totalTracks) > 0.5 
            ? 'Healthy' : 'Needs Attention',
        },
        trustDistribution: {
          leechers: parseInt(trustDistributionResult.rows[0].leechers || '0'),
          nodes: parseInt(trustDistributionResult.rows[0].nodes || '0'),
          guardians: parseInt(trustDistributionResult.rows[0].guardians || '0'),
          archivists: parseInt(trustDistributionResult.rows[0].archivists || '0'),
        },
        peerDistribution: {
          ephemeralPeers: parseInt(peerDistributionResult.rows[0].ephemeral_peers || '0'),
          mutualPeers: parseInt(peerDistributionResult.rows[0].mutual_peers || '0'),
          guardianPeers: parseInt(peerDistributionResult.rows[0].guardian_peers || '0'),
        },
      },
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
