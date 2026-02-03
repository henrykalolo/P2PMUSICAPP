/**
 * Swarm API Routes
 * Manages user participation in peer-to-peer content swarms
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import {
  createSwarm,
  joinSwarm,
  leaveSwarm,
  updateSwarmMemberStats,
  getUserSwarms,
  getNearbyPeers,
  pingSwarmPresence,
  SwarmRole,
} from '@/lib/swarm/schema';

// GET /api/swarm - Get user's swarm participation
export async function GET(request: NextRequest) {
  try {
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

    const userId = payload.userId as string;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'nearby') {
      // Get nearby peers with similar trust scores
      const limit = parseInt(searchParams.get('limit') || '10');
      const nearbyPeers = await getNearbyPeers(userId, limit);
      return NextResponse.json({
        success: true,
        peers: nearbyPeers,
      });
    }

    // Get user's swarm participation
    const swarms = await getUserSwarms(userId);
    return NextResponse.json({
      success: true,
      swarms,
    });
  } catch (error) {
    console.error('Swarm GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/swarm - Join a swarm or create new swarm
export async function POST(request: NextRequest) {
  try {
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

    const userId = payload.userId as string;
    const body = await request.json();
    const { action, contentId, contentType, name, swarmId, uploadedBytes, downloadedBytes } = body;

    switch (action) {
      case 'create': {
        // Create a new swarm for content
        if (!contentId || !name) {
          return NextResponse.json(
            { error: 'contentId and name are required' },
            { status: 400 }
          );
        }

        const swarm = await createSwarm(
          contentId,
          contentType || 'track',
          name,
          uploadedBytes || 0
        );

        // Auto-join as seeder
        await joinSwarm(userId, swarm.id, SwarmRole.SEEDER);

        return NextResponse.json({
          success: true,
          swarm,
        });
      }

      case 'join': {
        // Join an existing swarm
        if (!swarmId) {
          return NextResponse.json(
            { error: 'swarmId is required' },
            { status: 400 }
          );
        }

        // Get user's trust score from database
        const { query } = await import('@/lib/db');
        const trustResult = await query('SELECT trust_score FROM users WHERE id = $1', [userId]);
        const userTrustScore = trustResult.rows[0]?.trust_score || 0;

        // Determine role based on user's trust score
        const role = userTrustScore > 60 ? SwarmRole.REPAIRER : 
                     userTrustScore > 30 ? SwarmRole.SEEDER : 
                     SwarmRole.LEECHER;

        const member = await joinSwarm(userId, swarmId, role);

        return NextResponse.json({
          success: true,
          member,
        });
      }

      case 'ping': {
        // Ping to indicate still in swarm
        const swarmIds = body.swarmIds;
        if (!swarmIds || !Array.isArray(swarmIds)) {
          return NextResponse.json(
            { error: 'swarmIds array is required' },
            { status: 400 }
          );
        }

        await pingSwarmPresence(userId, swarmIds);

        return NextResponse.json({
          success: true,
          message: 'Presence updated',
        });
      }

      case 'update': {
        // Update upload/download stats
        if (!swarmId || uploadedBytes === undefined || downloadedBytes === undefined) {
          return NextResponse.json(
            { error: 'swarmId, uploadedBytes, and downloadedBytes are required' },
            { status: 400 }
          );
        }

        await updateSwarmMemberStats(userId, swarmId, uploadedBytes, downloadedBytes);

        return NextResponse.json({
          success: true,
          message: 'Stats updated',
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Swarm POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/swarm - Leave a swarm
export async function DELETE(request: NextRequest) {
  try {
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

    const userId = payload.userId as string;
    const { searchParams } = new URL(request.url);
    const swarmId = searchParams.get('swarmId');

    if (!swarmId) {
      return NextResponse.json(
        { error: 'swarmId is required' },
        { status: 400 }
      );
    }

    await leaveSwarm(userId, swarmId);

    return NextResponse.json({
      success: true,
      message: 'Left swarm successfully',
    });
  } catch (error) {
    console.error('Swarm DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
