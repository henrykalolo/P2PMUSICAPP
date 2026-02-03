import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth/jwt';

// PUT /api/auth/update-profile - Update user profile
export async function PUT(request: NextRequest) {
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

    const { 
      username, 
      avatarUrl, 
      artistBio, 
      artistGenres 
    } = await request.json();

    // Validate input
    if (username && (username.length < 3 || username.length > 30)) {
      return NextResponse.json(
        { error: 'Username must be between 3 and 30 characters' },
        { status: 400 }
      );
    }

    if (artistBio && artistBio.length > 500) {
      return NextResponse.json(
        { error: 'Bio must be less than 500 characters' },
        { status: 400 }
      );
    }

    // Check if username is already taken by another user
    if (username) {
      const existingUserResult = await query(
        'SELECT id FROM users WHERE username = $1 AND id != $2',
        [username, payload.userId]
      );
      
      if (existingUserResult.rows.length > 0) {
        return NextResponse.json(
          { error: 'Username already taken' },
          { status: 409 }
        );
      }
    }

    // Build update query
    const updates: string[] = [];
    const values: any[] = [];
    let valueIndex = 1;

    if (username) {
      updates.push(`username = $${valueIndex}`);
      values.push(username);
      valueIndex++;
    }

    if (avatarUrl) {
      updates.push(`avatar_url = $${valueIndex}`);
      values.push(avatarUrl);
      valueIndex++;
    }

    if (artistBio) {
      updates.push(`artist_bio = $${valueIndex}`);
      values.push(artistBio);
      valueIndex++;
    }

    if (artistGenres) {
      updates.push(`artist_genres = $${valueIndex}`);
      values.push(artistGenres);
      valueIndex++;
    }

    updates.push(`updated_at = NOW()`);
    values.push(payload.userId);

    // Execute update
    await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${valueIndex}`,
      values
    );

    // Fetch updated user data
    const userResult = await query(
      `SELECT id, username, email, avatar_url, role, 
              is_artist, can_upload, onboarding_completed, is_founder_user,
              trust_score, badge, artist_bio, artist_genres, artist_verified,
              created_at, updated_at
       FROM users 
       WHERE id = $1`,
      [payload.userId]
    );

    const user = userResult.rows[0];

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatar_url,
        role: user.role,
        isArtist: user.is_artist,
        canUpload: user.can_upload,
        onboardingCompleted: user.onboarding_completed,
        isFounderUser: user.is_founder_user,
        trustScore: user.trust_score,
        badge: user.badge,
        artistBio: user.artist_bio,
        artistGenres: user.artist_genres,
        artistVerified: user.artist_verified,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
