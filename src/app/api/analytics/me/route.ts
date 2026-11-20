import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth/jwt';

export const runtime = 'nodejs';

function numberOrZero(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function rate(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
}

/** GET /api/analytics/me - creator dashboard aggregates from real events. */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const payload = await verifyToken(authHeader.slice(7));
  if (!payload) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  try {
    const [summaryResult, seriesResult, topTracksResult] = await Promise.all([
      query(
        `SELECT
           COUNT(DISTINCT p.id)::int AS tracks,
           COALESCE(SUM(p.play_count), 0)::bigint AS plays,
           COALESCE(SUM(p.share_count), 0)::bigint AS shares,
           (SELECT COUNT(*)::int FROM likes l JOIN posts lp ON lp.id = l.post_id WHERE lp.author_id = $1) AS likes,
           (SELECT COUNT(*)::int FROM reposts r JOIN posts rp ON rp.id = r.post_id WHERE rp.author_id = $1) AS reposts,
           (SELECT COUNT(*)::int FROM comments c JOIN posts cp ON cp.id = c.post_id WHERE cp.author_id = $1) AS comments,
           (SELECT COUNT(*)::int FROM follows f WHERE f.following_id = $1) AS followers,
           (SELECT COUNT(*)::int FROM follows f WHERE f.follower_id = $1) AS following,
           (SELECT COUNT(*)::int FROM play_events pe JOIN posts ep ON ep.id = pe.post_id WHERE ep.author_id = $1 AND pe.event_type = 'play') AS play_events,
           (SELECT COUNT(*)::int FROM play_events pe JOIN posts ep ON ep.id = pe.post_id WHERE ep.author_id = $1 AND pe.event_type = 'complete') AS completions,
           (SELECT COUNT(*)::int FROM play_events pe JOIN posts ep ON ep.id = pe.post_id WHERE ep.author_id = $1 AND pe.event_type = 'skip') AS skips
         FROM posts p
         WHERE p.author_id = $1`,
        [payload.userId]
      ),
      query(
        `SELECT day::date AS day, COUNT(pe.id)::int AS plays
         FROM generate_series(CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE, INTERVAL '1 day') AS day
         LEFT JOIN (
           play_events pe
           JOIN posts p ON p.id = pe.post_id AND p.author_id = $1
         ) ON DATE(pe.created_at) = day::date AND pe.event_type = 'play'
         GROUP BY day
         ORDER BY day`,
        [payload.userId]
      ),
      query(
        `SELECT p.id, p.title, p.cover_art_url, p.play_count,
                (SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id) AS likes,
                (SELECT COUNT(*)::int FROM comments c WHERE c.post_id = p.id) AS comments,
                (SELECT COUNT(*)::int FROM play_events pe WHERE pe.post_id = p.id AND pe.event_type = 'play') AS play_events,
                (SELECT COUNT(*)::int FROM play_events pe WHERE pe.post_id = p.id AND pe.event_type = 'complete') AS completions,
                (SELECT COUNT(*)::int FROM play_events pe WHERE pe.post_id = p.id AND pe.event_type = 'skip') AS skips
         FROM posts p
         WHERE p.author_id = $1
         ORDER BY p.play_count DESC, p.created_at DESC
         LIMIT 5`,
        [payload.userId]
      ),
    ]);

    const summary = summaryResult.rows[0] as Record<string, unknown> | undefined;
    const plays = numberOrZero(summary?.plays);
    const playEvents = numberOrZero(summary?.play_events);
    const completions = numberOrZero(summary?.completions);
    const skips = numberOrZero(summary?.skips);

    return NextResponse.json({
      success: true,
      analytics: {
        summary: {
          tracks: numberOrZero(summary?.tracks),
          plays,
          shares: numberOrZero(summary?.shares),
          likes: numberOrZero(summary?.likes),
          reposts: numberOrZero(summary?.reposts),
          comments: numberOrZero(summary?.comments),
          followers: numberOrZero(summary?.followers),
          following: numberOrZero(summary?.following),
          playEvents,
          completionRate: rate(completions, playEvents),
          skipRate: rate(skips, playEvents),
        },
        playsLast14Days: seriesResult.rows.map((row: Record<string, any>) => ({
          date: row.day,
          plays: numberOrZero(row.plays),
        })),
        topTracks: topTracksResult.rows.map((row: Record<string, any>) => ({
          id: row.id,
          title: row.title,
          coverArtUrl: row.cover_art_url || null,
          plays: numberOrZero(row.play_count),
          likes: numberOrZero(row.likes),
          comments: numberOrZero(row.comments),
          completionRate: rate(numberOrZero(row.completions), numberOrZero(row.play_events)),
          skipRate: rate(numberOrZero(row.skips), numberOrZero(row.play_events)),
        })),
      },
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
