import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth/jwt';

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

    const userId = payload.userId;

    // Get user's preferences
    const preferencesResult = await query(
      'SELECT preference_value FROM music_preferences WHERE user_id = $1',
      [userId]
    );

    const preferenceValues = preferencesResult.rows.map((row) => row.preference_value);

    // Find users with overlapping preferences, excluding already followed
    let suggestions;
    if (preferenceValues.length > 0) {
      const result = await query(
        `SELECT DISTINCT u.id, u.username, u.avatar_url, u.artist_bio,
                COUNT(mp.preference_value) as matching_preferences
         FROM users u
         JOIN music_preferences mp ON u.id = mp.user_id
         WHERE u.id != $1
           AND u.id NOT IN (SELECT following_id FROM follows WHERE follower_id = $1)
           AND mp.preference_value = ANY($2)
         GROUP BY u.id, u.username, u.avatar_url, u.artist_bio
         ORDER BY matching_preferences DESC
         LIMIT 20`,
        [userId, preferenceValues]
      );
      suggestions = result.rows;
    } else {
      // If no preferences, return most active users
      const result = await query(
        `SELECT u.id, u.username, u.avatar_url, u.artist_bio, 0 as matching_preferences
         FROM users u
         WHERE u.id != $1
           AND u.id NOT IN (SELECT following_id FROM follows WHERE follower_id = $1)
         ORDER BY u.created_at DESC
         LIMIT 20`,
        [userId]
      );
      suggestions = result.rows;
    }

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('Get suggested users error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
