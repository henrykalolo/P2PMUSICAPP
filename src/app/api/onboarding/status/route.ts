import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth/jwt';

const ONBOARDING_REQUIREMENTS = {
  MIN_PREFERENCES: 5,
  MIN_FOLLOWS: 10,
  FOUNDER_USER_COUNT: 11,
};

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

    // Get user info
    const userResult = await query(
      'SELECT is_founder_user, onboarding_completed FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const user = userResult.rows[0];

    // Founder users are automatically onboarded
    if (user.is_founder_user) {
      return NextResponse.json({
        complete: true,
        reason: 'founder_user',
      });
    }

    // Get preferences count
    const preferencesResult = await query(
      'SELECT COUNT(*) FROM music_preferences WHERE user_id = $1',
      [userId]
    );
    const preferencesCount = parseInt(preferencesResult.rows[0].count);

    // Get follows count
    const followsResult = await query(
      'SELECT COUNT(*) FROM follows WHERE follower_id = $1',
      [userId]
    );
    const followsCount = parseInt(followsResult.rows[0].count);

    const isComplete =
      preferencesCount >= ONBOARDING_REQUIREMENTS.MIN_PREFERENCES &&
      followsCount >= ONBOARDING_REQUIREMENTS.MIN_FOLLOWS;

    // If complete but not marked, update the user
    if (isComplete && !user.onboarding_completed) {
      await query(
        'UPDATE users SET onboarding_completed = true, can_upload = true WHERE id = $1',
        [userId]
      );
    }

    return NextResponse.json({
      complete: isComplete,
      progress: {
        preferences: {
          current: preferencesCount,
          required: ONBOARDING_REQUIREMENTS.MIN_PREFERENCES,
        },
        follows: {
          current: followsCount,
          required: ONBOARDING_REQUIREMENTS.MIN_FOLLOWS,
        },
      },
    });
  } catch (error) {
    console.error('Onboarding status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
