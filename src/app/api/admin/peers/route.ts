import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth/jwt';

// GET /api/admin/peers - Get peer/swarm monitoring data
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

    // Get active torrents with peer counts
    // Note: Since we don't have a real-time peer tracking table yet,
    // we'll simulate with data from posts and user_stats
    const torrentsResult = await query(`
      SELECT 
        p.id,
        p.title,
        p.artist,
        p.genre,
        p.info_hash,
        p.ipfs_cid,
        p.storage_type,
        p.created_at,
        u.username as author_username,
        COALESCE(us.total_uploaded, 0) as total_uploaded,
        COALESCE(us.upload_ratio, 0) as upload_ratio
      FROM posts p
      JOIN users u ON p.author_id = u.id
      LEFT JOIN user_stats us ON p.author_id = us.user_id
      WHERE p.storage_type IN ('torrent', 'hybrid')
      ORDER BY p.created_at DESC
      LIMIT 50
    `);

    // Get tracks that need more seeding (low peer count simulation)
    // In a real implementation, this would query a peer tracking service
    const needsSeedingResult = await query(`
      SELECT 
        p.id,
        p.title,
        p.artist,
        p.genre,
        p.info_hash,
        p.ipfs_cid,
        p.storage_type,
        p.created_at,
        u.username as author_username,
        COALESCE(us.upload_ratio, 0) as upload_ratio
      FROM posts p
      JOIN users u ON p.author_id = u.id
      LEFT JOIN user_stats us ON p.author_id = us.user_id
      WHERE p.storage_type IN ('torrent', 'hybrid')
        AND (us.upload_ratio < 1 OR us.upload_ratio IS NULL)
      ORDER BY p.created_at DESC
      LIMIT 20
    `);

    // Get top seeded tracks (high upload ratio)
    const topSeededResult = await query(`
      SELECT 
        p.id,
        p.title,
        p.artist,
        p.genre,
        p.info_hash,
        p.ipfs_cid,
        p.storage_type,
        p.created_at,
        u.username as author_username,
        COALESCE(us.total_uploaded, 0) as total_uploaded,
        COALESCE(us.upload_ratio, 0) as upload_ratio
      FROM posts p
      JOIN users u ON p.author_id = u.id
      LEFT JOIN user_stats us ON p.author_id = us.user_id
      WHERE p.storage_type IN ('torrent', 'hybrid')
        AND us.upload_ratio > 1
      ORDER BY us.upload_ratio DESC
      LIMIT 20
    `);

    // Get IPFS-only tracks
    const ipfsTracksResult = await query(`
      SELECT 
        p.id,
        p.title,
        p.artist,
        p.genre,
        p.ipfs_cid,
        p.ipfs_gateway_url,
        p.created_at,
        u.username as author_username
      FROM posts p
      JOIN users u ON p.author_id = u.id
      WHERE p.storage_type = 'ipfs'
      ORDER BY p.created_at DESC
      LIMIT 50
    `);

    // Calculate swarm health metrics
    const totalTorrents = torrentsResult.rows.length;
    const healthyTorrents = topSeededResult.rows.length;
    const unhealthyTorrents = needsSeedingResult.rows.length;
    const healthPercentage = totalTorrents > 0 
      ? Math.round((healthyTorrents / totalTorrents) * 100) 
      : 0;

    return NextResponse.json({
      success: true,
      peers: {
        activeTorrents: torrentsResult.rows.map((row: Record<string, unknown>) => ({
          id: row.id,
          title: row.title,
          artist: row.artist,
          genre: row.genre,
          infoHash: row.info_hash,
          ipfsCid: row.ipfs_cid,
          storageType: row.storage_type,
          createdAt: row.created_at,
          authorUsername: row.author_username,
          totalUploaded: row.total_uploaded,
          uploadRatio: row.upload_ratio,
          // Simulated peer count based on upload ratio
          peerCount: Math.max(1, Math.floor((row.upload_ratio as number || 0) * 3) + 1),
          seedCount: Math.max(1, Math.floor((row.upload_ratio as number || 0) * 2) + 1),
          leechCount: Math.max(0, Math.floor((row.upload_ratio as number || 0) * 1)),
        })),
        needsSeeding: needsSeedingResult.rows.map((row: Record<string, unknown>) => ({
          id: row.id,
          title: row.title,
          artist: row.artist,
          genre: row.genre,
          infoHash: row.info_hash,
          ipfsCid: row.ipfs_cid,
          storageType: row.storage_type,
          createdAt: row.created_at,
          authorUsername: row.author_username,
          uploadRatio: row.upload_ratio,
          peerCount: Math.max(0, Math.floor((row.upload_ratio as number || 0) * 2)),
          priority: (row.upload_ratio as number || 0) < 0.5 ? 'high' : 'medium',
        })),
        topSeeded: topSeededResult.rows.map((row: Record<string, unknown>) => ({
          id: row.id,
          title: row.title,
          artist: row.artist,
          genre: row.genre,
          infoHash: row.info_hash,
          ipfsCid: row.ipfs_cid,
          storageType: row.storage_type,
          createdAt: row.created_at,
          authorUsername: row.author_username,
          totalUploaded: row.total_uploaded,
          uploadRatio: row.upload_ratio,
          peerCount: Math.floor((row.upload_ratio as number || 0) * 5) + 2,
          seedCount: Math.floor((row.upload_ratio as number || 0) * 3) + 2,
        })),
        ipfsOnly: ipfsTracksResult.rows.map((row: Record<string, unknown>) => ({
          id: row.id,
          title: row.title,
          artist: row.artist,
          genre: row.genre,
          ipfsCid: row.ipfs_cid,
          ipfsGatewayUrl: row.ipfs_gateway_url,
          createdAt: row.created_at,
          authorUsername: row.author_username,
        })),
        swarmHealth: {
          totalTorrents,
          healthyTorrents,
          unhealthyTorrents,
          healthPercentage,
          status: healthPercentage >= 70 ? 'healthy' : healthPercentage >= 40 ? 'degraded' : 'critical',
        },
      },
    });
  } catch (error) {
    console.error('Admin peers error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
