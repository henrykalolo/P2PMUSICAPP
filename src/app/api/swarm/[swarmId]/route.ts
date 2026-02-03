/**
 * Swarm Details API Route
 * Get swarm information and members
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { getSwarmMembers, getSwarmStats, SwarmRole } from '@/lib/swarm/schema';

// GET /api/swarm/[swarmId] - Get swarm details and members
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ swarmId: string }> }
) {
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

    const { swarmId } = await params;

    // Get swarm members
    const members = await getSwarmMembers(swarmId) as any[];

    // Get swarm stats
    const stats = await getSwarmStats(swarmId);

    // Categorize members by role
    const roleDistribution = {
      [SwarmRole.SEEDER]: members.filter(m => m.role === SwarmRole.SEEDER).length,
      [SwarmRole.LEECHER]: members.filter(m => m.role === SwarmRole.LEECHER).length,
      [SwarmRole.ARCHIVER]: members.filter(m => m.role === SwarmRole.ARCHIVER).length,
      [SwarmRole.REPAIRER]: members.filter(m => m.role === SwarmRole.REPAIRER).length,
    };

    return NextResponse.json({
      success: true,
      swarmId,
      stats: {
        ...stats,
        totalUpload: stats.totalUpload || 0,
        totalDownload: stats.totalDownload || 0,
        averageReputation: stats.averageReputation || 0,
        onlineMembers: stats.onlineMembers || 0,
      },
      roleDistribution,
      members: members.map(m => ({
        id: m.id,
        userId: m.user_id,
        username: m.username,
        avatarUrl: m.avatar_url,
        trustScore: m.trust_score,
        role: m.role,
        reputationScore: m.reputation_score,
        isOnline: m.is_online,
        bytesUploaded: m.bytes_uploaded,
        bytesDownloaded: m.bytes_downloaded,
        joinedAt: m.joined_at,
        lastActiveAt: m.last_active_at,
      })),
    });
  } catch (error) {
    console.error('Swarm details GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
