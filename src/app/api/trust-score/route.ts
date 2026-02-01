/**
 * User Trust Score (UTS) API
 * Manages reputation system for prioritizing high-quality peers
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth/jwt';

// GET /api/trust-score - Get user's trust score and breakdown
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

    const userId = request.nextUrl.searchParams.get('userId') || payload.userId;

    // Get user's trust score and stats
    const result = await query(
      `
        SELECT 
          u.trust_score,
          u.badge,
          COALESCE(us.upload_ratio, 0) as upload_ratio,
          COALESCE(us.avg_session_duration, 0) as avg_session_duration,
          COALESCE(us.hash_verification_rate, 0) as hash_verification_rate,
          COALESCE(us.mutual_connections, 0) as mutual_connections,
          COALESCE(us.total_uploaded, 0) as total_uploaded,
          COALESCE(us.total_downloaded, 0) as total_downloaded,
          COALESCE(us.successful_verifications, 0) as successful_verifications,
          COALESCE(us.total_verifications, 0) as total_verifications
        FROM users u
        LEFT JOIN user_stats us ON u.id = us.user_id
        WHERE u.id = $1
      `,
      [userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const stats = result.rows[0];

    // Calculate component scores (each out of 100)
    const uploadRatioScore = Math.min(stats.upload_ratio * 20, 100); // 40% weight
    const connectionStabilityScore = Math.min(stats.avg_session_duration / 3600 * 10, 100); // 25% weight
    const integrityScore = stats.hash_verification_rate * 100; // 20% weight
    const socialScore = Math.min(stats.mutual_connections * 5, 100); // 15% weight

    // Calculate weighted trust score
    const trustScore = Math.round(
      uploadRatioScore * 0.40 +
      connectionStabilityScore * 0.25 +
      integrityScore * 0.20 +
      socialScore * 0.15
    );

    // Update trust score if it has changed significantly
    if (Math.abs(trustScore - stats.trust_score) > 5) {
      await query(
        'UPDATE users SET trust_score = $1 WHERE id = $2',
        [trustScore, userId]
      );
    }

    return NextResponse.json({
      userId,
      trustScore,
      badge: stats.badge,
      breakdown: {
        uploadRatio: {
          score: Math.round(uploadRatioScore),
          weight: 40,
          value: stats.upload_ratio.toFixed(2),
          description: 'Bytes uploaded / downloaded'
        },
        connectionStability: {
          score: Math.round(connectionStabilityScore),
          weight: 25,
          value: `${Math.round(stats.avg_session_duration / 60)} min`,
          description: 'Average session duration'
        },
        contentIntegrity: {
          score: Math.round(integrityScore),
          weight: 20,
          value: `${Math.round(stats.hash_verification_rate * 100)}%`,
          description: 'Successful hash verification rate'
        },
        socialVerification: {
          score: Math.round(socialScore),
          weight: 15,
          value: stats.mutual_connections,
          description: 'Mutual connections count'
        }
      },
      stats: {
        totalUploaded: stats.total_uploaded,
        totalDownloaded: stats.total_downloaded,
        successfulVerifications: stats.successful_verifications,
        totalVerifications: stats.total_verifications
      }
    });
  } catch (error) {
    console.error('Trust score fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/trust-score/update - Update user stats (called by client)
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
    const {
      uploadedBytes,
      downloadedBytes,
      sessionDuration,
      verificationResult,
      peerConnections
    } = body;

    // Update user stats
    await query(
      `
        INSERT INTO user_stats (
          user_id, 
          total_uploaded, 
          total_downloaded, 
          session_count,
          total_session_duration,
          successful_verifications,
          total_verifications,
          last_updated
        )
        VALUES ($1, $2, $3, 1, $4, $5, $6, NOW())
        ON CONFLICT (user_id) 
        DO UPDATE SET
          total_uploaded = user_stats.total_uploaded + $2,
          total_downloaded = user_stats.total_downloaded + $3,
          session_count = user_stats.session_count + 1,
          total_session_duration = user_stats.total_session_duration + $4,
          successful_verifications = user_stats.successful_verifications + $5,
          total_verifications = user_stats.total_verifications + $6,
          upload_ratio = (user_stats.total_uploaded + $2)::float / NULLIF(user_stats.total_downloaded + $3, 0),
          avg_session_duration = (user_stats.total_session_duration + $4)::float / (user_stats.session_count + 1),
          hash_verification_rate = (user_stats.successful_verifications + $5)::float / NULLIF(user_stats.total_verifications + $6, 0),
          last_updated = NOW()
      `,
      [
        payload.userId,
        uploadedBytes || 0,
        downloadedBytes || 0,
        sessionDuration || 0,
        verificationResult === true ? 1 : 0,
        verificationResult !== undefined ? 1 : 0
      ]
    );

    // Update mutual connections count
    if (peerConnections) {
      await query(
        `
          UPDATE user_stats 
          SET mutual_connections = (
            SELECT COUNT(*) FROM follows 
            WHERE follower_id = $1 
            AND following_id IN (
              SELECT follower_id FROM follows WHERE following_id = $1
            )
          )
          WHERE user_id = $1
        `,
        [payload.userId]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Trust score update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/trust-score/leaderboard - Get top users by trust score
export async function GET_leaderboard(request: NextRequest) {
  try {
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '10');
    const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0');

    const result = await query(
      `
        SELECT 
          u.id,
          u.username,
          u.avatar_url,
          u.trust_score,
          u.badge,
          COALESCE(us.upload_ratio, 0) as upload_ratio
        FROM users u
        LEFT JOIN user_stats us ON u.id = us.user_id
        ORDER BY u.trust_score DESC
        LIMIT $1 OFFSET $2
      `,
      [limit, offset]
    );

    return NextResponse.json({
      users: result.rows,
      limit,
      offset
    });
  } catch (error) {
    console.error('Leaderboard fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
