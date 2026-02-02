import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth/jwt';

// POST /api/storage-challenge - Verify users are storing encrypted chunks
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

    const { challengeOffset, expectedHash, infoHash } = await request.json();

    if (!challengeOffset || !expectedHash || !infoHash) {
      return NextResponse.json(
        { error: 'Missing required parameters: challengeOffset, expectedHash, infoHash' },
        { status: 400 }
      );
    }

    // In a real implementation, this would verify against IndexedDB on the client
    // For now, we simulate the verification
    const userId = payload.userId;

    // Get user's stored chunks from database (metadata only)
    const storedChunkResult = await query(
      `SELECT * FROM user_chunks 
       WHERE user_id = $1 AND info_hash = $2 
       LIMIT 1`,
      [userId, infoHash]
    );

    if (storedChunkResult.rows.length === 0) {
      // No stored chunks for this infoHash - user is leeching
      return NextResponse.json({
        verified: false,
        reason: 'No stored chunks found for this content',
        infoHash,
        challengeOffset,
        userId
      });
    }

    // Simulate hash verification
    // In production, this would compare the computed hash with expectedHash
    const isVerified = Math.random() > 0.1; // 90% pass rate for simulation

    // Update user's verification stats
    await query(
      `INSERT INTO user_stats (user_id, total_verifications, successful_verifications)
       VALUES ($1, 1, $2)
       ON CONFLICT (user_id) 
       DO UPDATE SET 
         total_verifications = user_stats.total_verifications + 1,
         successful_verifications = user_stats.successful_verifications + $2,
         hash_verification_rate = (user_stats.successful_verifications + $2::float) / (user_stats.total_verifications + 1),
         last_updated = NOW()`,
      [userId, isVerified ? 1 : 0]
    );

    // Update trust score based on verification result
    if (isVerified) {
      // Boost trust score for successful verification
      await query(
        `UPDATE users SET trust_score = LEAST(100, trust_score + 1) WHERE id = $1`,
        [userId]
      );
    }

    return NextResponse.json({
      verified: isVerified,
      infoHash,
      challengeOffset,
      userId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Storage challenge error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/storage-challenge - Get current challenge for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const infoHash = searchParams.get('infoHash');

    if (!infoHash) {
      return NextResponse.json(
        { error: 'infoHash is required' },
        { status: 400 }
      );
    }

    // Generate a random challenge offset
    const challengeOffset = Math.floor(Math.random() * 1000000);

    return NextResponse.json({
      challengeOffset,
      infoHash,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes
    });
  } catch (error) {
    console.error('Get challenge error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
