import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth/jwt';
import { getUserProfile } from '@/lib/profile';
import { isAllowedImageUrl, parsePublicFileUrl } from '@/lib/storage/public-url';
import { deleteFileUnified } from '@/lib/storage/unifiedStorage';

// PUT /api/auth/update-profile - Update user profile
export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyToken(authHeader.slice(7));
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const {
      username,
      avatarUrl,
      artistBio,
      artistGenres,
    } = body as {
      username?: string;
      avatarUrl?: string;
      artistBio?: string;
      artistGenres?: string[];
    };

    if (username !== undefined) {
      const clean = username.trim();
      if (clean.length < 3 || clean.length > 30) {
        return NextResponse.json(
          { error: 'Username must be between 3 and 30 characters' },
          { status: 400 }
        );
      }
      if (!/^[a-zA-Z0-9_.-]+$/.test(clean)) {
        return NextResponse.json(
          { error: 'Username may only contain letters, numbers, dots, dashes, and underscores' },
          { status: 400 }
        );
      }
    }

    if (artistBio !== undefined && artistBio.length > 500) {
      return NextResponse.json(
        { error: 'Bio must be less than 500 characters' },
        { status: 400 }
      );
    }

    if (
      artistGenres !== undefined &&
      (!Array.isArray(artistGenres) ||
        artistGenres.length > 10 ||
        artistGenres.some((g) => typeof g !== 'string' || g.length > 30))
    ) {
      return NextResponse.json(
        { error: 'Provide at most 10 genres, each under 30 characters' },
        { status: 400 }
      );
    }

    if (avatarUrl !== undefined && avatarUrl !== '' && !isAllowedImageUrl(avatarUrl)) {
      return NextResponse.json({ error: 'Invalid avatar URL' }, { status: 400 });
    }

    if (username !== undefined && username.trim()) {
      const existing = await query(
        'SELECT id FROM users WHERE username = $1 AND id != $2',
        [username.trim(), payload.userId]
      );
      if (existing.rows.length > 0) {
        return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
      }
    }

    const current = await query(
      'SELECT avatar_url FROM users WHERE id = $1',
      [payload.userId]
    );
    const previousAvatarUrl = current.rows[0]?.avatar_url as string | null;

    const updates: string[] = [];
    const values: any[] = [];
    let valueIndex = 1;

    const add = (clause: string, value: unknown) => {
      updates.push(`${clause} = $${valueIndex}`);
      values.push(value);
      valueIndex++;
    };

    if (username !== undefined) add('username', username.trim());
    if (avatarUrl !== undefined) add('avatar_url', avatarUrl || null);
    if (artistBio !== undefined) add('artist_bio', artistBio || null);
    if (artistGenres !== undefined) add('artist_genres', artistGenres);

    if (updates.length > 0) {
      updates.push(`updated_at = NOW()`);
      values.push(payload.userId);
      await query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${valueIndex}`,
        values
      );
    }

    // Remove the replaced avatar from storage. A failed cleanup must not fail
    // the profile update itself.
    if (avatarUrl !== undefined && previousAvatarUrl && previousAvatarUrl !== avatarUrl) {
      const ref = parsePublicFileUrl(previousAvatarUrl);
      if (ref && ref.userId === payload.userId && ref.fileType === 'avatar') {
        try {
          await deleteFileUnified(payload.userId, 'server', ref.fileId, 'avatar');
        } catch (error) {
          console.warn('Could not remove previous avatar file', error);
        }
      }
    }

    const user = await getUserProfile(payload.userId);
    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
