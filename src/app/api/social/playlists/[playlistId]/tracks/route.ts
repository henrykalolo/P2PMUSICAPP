import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth/jwt';
import { isUuid } from '@/lib/storage/public-url';

export const runtime = 'nodejs';

type Context = { params: Promise<{ playlistId: string }> };

/** POST /api/social/playlists/:playlistId/tracks - add a track to your playlist. */
export async function POST(request: NextRequest, context: Context) {
  const { playlistId } = await context.params;
  if (!isUuid(playlistId)) {
    return NextResponse.json({ error: 'Invalid playlist id' }, { status: 400 });
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const payload = await verifyToken(authHeader.slice(7));
  if (!payload) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { trackId?: unknown };
    if (!isUuid(body.trackId)) {
      return NextResponse.json({ error: 'Invalid track id' }, { status: 400 });
    }

    const playlist = await query(
      'SELECT id FROM playlists WHERE id = $1 AND user_id = $2',
      [playlistId, payload.userId]
    );
    if (playlist.rows.length === 0) {
      return NextResponse.json({ error: 'Playlist not found' }, { status: 404 });
    }

    const track = await query('SELECT id FROM posts WHERE id = $1', [body.trackId]);
    if (track.rows.length === 0) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    const nextPosition = await query(
      'SELECT COALESCE(MAX(position), 0) + 1 AS position FROM playlist_tracks WHERE playlist_id = $1',
      [playlistId]
    );

    await query(
      `INSERT INTO playlist_tracks (playlist_id, track_id, position)
       VALUES ($1, $2, $3)
       ON CONFLICT (playlist_id, track_id) DO NOTHING`,
      [playlistId, body.trackId, nextPosition.rows[0].position]
    );

    const count = await query(
      'SELECT COUNT(*)::int AS count FROM playlist_tracks WHERE playlist_id = $1',
      [playlistId]
    );

    return NextResponse.json({ success: true, tracksCount: count.rows[0].count });
  } catch (error) {
    console.error('Add playlist track error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
