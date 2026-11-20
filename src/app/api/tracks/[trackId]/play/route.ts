import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth/jwt';

export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVENT_TYPES = new Set(['play', 'complete', 'skip']);

function nonNegativeInt(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.min(Math.floor(parsed), 86_400) : 0;
}

/**
 * POST /api/tracks/:trackId/play
 * Records a listening event. Playback itself never depends on this endpoint;
 * if telemetry fails the audio keeps playing.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ trackId: string }> }
) {
  const { trackId } = await context.params;
  if (!UUID_RE.test(trackId)) {
    return NextResponse.json({ error: 'Invalid track id' }, { status: 400 });
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
    const body = (await request.json()) as {
      eventType?: unknown;
      progressSeconds?: unknown;
      durationSeconds?: unknown;
      eventId?: unknown;
    };

    if (typeof body.eventType !== 'string' || !EVENT_TYPES.has(body.eventType)) {
      return NextResponse.json({ error: 'Invalid event type' }, { status: 400 });
    }

    const track = await query('SELECT id FROM posts WHERE id = $1', [trackId]);
    if (track.rows.length === 0) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    const eventId =
      typeof body.eventId === 'string' && UUID_RE.test(body.eventId)
        ? body.eventId
        : null;

    const inserted = await query(
      `INSERT INTO play_events
         (user_id, post_id, event_type, client_event_id, progress_seconds, duration_seconds)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (client_event_id) DO NOTHING
       RETURNING id`,
      [
        payload.userId,
        trackId,
        body.eventType,
        eventId,
        nonNegativeInt(body.progressSeconds),
        nonNegativeInt(body.durationSeconds),
      ]
    );

    if (inserted.rows.length > 0 && body.eventType === 'play') {
      await query(
        'UPDATE posts SET play_count = play_count + 1 WHERE id = $1',
        [trackId]
      );
    }

    return NextResponse.json({ success: true, recorded: inserted.rows.length > 0 });
  } catch (error) {
    console.error('Record play event error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
