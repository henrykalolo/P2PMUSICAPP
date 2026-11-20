import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth/jwt';
import { isUuid } from '@/lib/storage/public-url';

export const runtime = 'nodejs';

async function getUserId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const payload = await verifyToken(authHeader.slice(7));
  return payload?.userId || null;
}

/** GET /api/messages/conversations - inbox for the authenticated user. */
export async function GET(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await query(
      `SELECT c.id, c.created_at, c.updated_at,
              other.id AS other_id, other.username AS other_username,
              other.avatar_url AS other_avatar,
              (SELECT m.body FROM conversation_messages m
                WHERE m.conversation_id = c.id
                ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_message,
              (SELECT m.created_at FROM conversation_messages m
                WHERE m.conversation_id = c.id
                ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_message_at,
              (SELECT COUNT(*)::int FROM conversation_messages m
                WHERE m.conversation_id = c.id
                  AND m.sender_id IS DISTINCT FROM cp.user_id
                  AND (cp.last_read_at IS NULL OR m.created_at > cp.last_read_at)) AS unread_count
         FROM conversations c
         JOIN conversation_participants cp
           ON cp.conversation_id = c.id AND cp.user_id = $1
         JOIN conversation_participants op
           ON op.conversation_id = c.id AND op.user_id <> $1
         JOIN users other ON other.id = op.user_id
        ORDER BY c.updated_at DESC`,
      [userId]
    );

    return NextResponse.json({
      success: true,
      conversations: result.rows.map((row: Record<string, any>) => ({
        id: row.id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastMessage: row.last_message || null,
        lastMessageAt: row.last_message_at || null,
        unreadCount: Number(row.unread_count) || 0,
        otherUser: {
          id: row.other_id,
          username: row.other_username,
          avatarUrl: row.other_avatar || null,
        },
      })),
    });
  } catch (error) {
    console.error('List conversations error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** POST /api/messages/conversations - start or reuse a 1:1 conversation. */
export async function POST(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { participantId?: unknown };
    if (!isUuid(body.participantId)) {
      return NextResponse.json({ error: 'Invalid participant id' }, { status: 400 });
    }
    if (body.participantId === userId) {
      return NextResponse.json({ error: 'You cannot message yourself' }, { status: 400 });
    }

    const target = await query('SELECT id, username FROM users WHERE id = $1', [body.participantId]);
    if (target.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const existing = await query(
      `SELECT c.id
         FROM conversations c
         JOIN conversation_participants cp ON cp.conversation_id = c.id
        WHERE cp.user_id IN ($1, $2)
        GROUP BY c.id
        HAVING COUNT(DISTINCT cp.user_id) = 2
           AND (SELECT COUNT(*) FROM conversation_participants WHERE conversation_id = c.id) = 2
        LIMIT 1`,
      [userId, body.participantId]
    );

    let conversationId = existing.rows[0]?.id as string | undefined;

    if (!conversationId) {
      const created = await query(
        'INSERT INTO conversations (created_by) VALUES ($1) RETURNING id',
        [userId]
      );
      conversationId = created.rows[0].id;
      await query(
        `INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2), ($1, $3)`,
        [conversationId, userId, body.participantId]
      );
    }

    return NextResponse.json({
      success: true,
      conversation: {
        id: conversationId,
        otherUser: {
          id: target.rows[0].id,
          username: target.rows[0].username,
        },
      },
    });
  } catch (error) {
    console.error('Create conversation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
