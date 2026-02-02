import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth/jwt';

interface Preference {
  type: 'genre' | 'artist' | 'mood' | 'era';
  value: string;
}

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

    const userId = payload.userId;
    const body = await request.json();
    const { preferences }: { preferences: Preference[] } = body;

    if (!Array.isArray(preferences) || preferences.length === 0) {
      return NextResponse.json(
        { error: 'Preferences must be a non-empty array' },
        { status: 400 }
      );
    }

    // Insert preferences
    const values = preferences
      .map((_, index) => `($1, $${index * 2 + 2}, $${index * 2 + 3})`)
      .join(', ');

    const params = [userId];
    for (const pref of preferences) {
      params.push(pref.type, pref.value);
    }

    await query(
      `INSERT INTO music_preferences (user_id, preference_type, preference_value) 
       VALUES ${values} 
       ON CONFLICT (user_id, preference_type, preference_value) DO NOTHING`,
      params
    );

    // Update user's preference count
    const countResult = await query(
      'SELECT COUNT(*) FROM music_preferences WHERE user_id = $1',
      [userId]
    );
    const count = parseInt(countResult.rows[0].count);

    await query(
      'UPDATE users SET music_preferences_selected = $1 WHERE id = $2',
      [count, userId]
    );

    return NextResponse.json({
      success: true,
      saved: preferences.length,
      total: count,
    });
  } catch (error) {
    console.error('Save preferences error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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
    const result = await query(
      'SELECT preference_type, preference_value FROM music_preferences WHERE user_id = $1',
      [userId]
    );

    const preferences = result.rows.map((row: { preference_type: string; preference_value: string }) => ({
      type: row.preference_type,
      value: row.preference_value,
    }));

    return NextResponse.json({ preferences });
  } catch (error) {
    console.error('Get preferences error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
