/**
 * Trust Score Leaderboard API
 * Get top users by trust score
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET /api/trust-score/leaderboard - Get top users by trust score
export async function GET(request: NextRequest) {
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
