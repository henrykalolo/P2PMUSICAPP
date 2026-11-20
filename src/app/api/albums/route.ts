import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth/jwt';
import { isAllowedImageUrl, isUuid } from '@/lib/storage/public-url';

export const runtime = 'nodejs';

/** GET /api/albums?userId=... - list releases; omit userId with a token for your own. */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const payload = authHeader?.startsWith('Bearer ')
      ? await verifyToken(authHeader.slice(7))
      : null;
    const requestedUserId = request.nextUrl.searchParams.get('userId');
    const userId = requestedUserId || payload?.userId || null;

    if (!userId || !isUuid(userId)) {
      return NextResponse.json({ error: 'A valid userId is required' }, { status: 400 });
    }

    const result = await query(
      `SELECT a.*, u.username AS owner_username,
              (SELECT COUNT(*)::int FROM posts p WHERE p.album_id = a.id) AS tracks_count
         FROM albums a
         JOIN users u ON u.id = a.owner_id
        WHERE a.owner_id = $1
        ORDER BY a.release_date DESC NULLS LAST, a.created_at DESC`,
      [userId]
    );

    return NextResponse.json({
      success: true,
      albums: result.rows.map((row: Record<string, any>) => ({
        id: row.id,
        title: row.title,
        artist: row.artist,
        description: row.description,
        genre: row.genre,
        releaseDate: row.release_date,
        coverArtUrl: row.cover_art_url,
        tracksCount: Number(row.tracks_count) || 0,
        createdAt: row.created_at,
        owner: { id: row.owner_id, username: row.owner_username },
      })),
    });
  } catch (error) {
    console.error('List albums error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** POST /api/albums - create a release owned by the authenticated user. */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const payload = await verifyToken(authHeader.slice(7));
  if (!payload) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const artist = typeof body.artist === 'string' ? body.artist.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const genre = typeof body.genre === 'string' ? body.genre.trim() : '';
    const releaseDate = typeof body.releaseDate === 'string' ? body.releaseDate : '';
    const coverArtUrl = typeof body.coverArtUrl === 'string' ? body.coverArtUrl : null;

    if (!title || title.length > 200) {
      return NextResponse.json({ error: 'Album title is required (max 200 characters)' }, { status: 400 });
    }
    if (description.length > 1000) {
      return NextResponse.json({ error: 'Description is too long' }, { status: 400 });
    }
    if (releaseDate && !/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) {
      return NextResponse.json({ error: 'Invalid release date' }, { status: 400 });
    }
    if (coverArtUrl && !isAllowedImageUrl(coverArtUrl)) {
      return NextResponse.json({ error: 'Invalid cover art URL' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO albums (owner_id, title, artist, description, genre, release_date, cover_art_url)
       VALUES ($1, $2, $3, NULLIF($4, ''), NULLIF($5, ''), NULLIF($6, '')::date, $7)
       RETURNING *`,
      [
        payload.userId,
        title,
        artist || null,
        description,
        genre,
        releaseDate,
        coverArtUrl,
      ]
    );

    const row = result.rows[0];
    return NextResponse.json(
      {
        success: true,
        album: {
          id: row.id,
          title: row.title,
          artist: row.artist,
          description: row.description,
          genre: row.genre,
          releaseDate: row.release_date,
          coverArtUrl: row.cover_art_url,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create album error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
