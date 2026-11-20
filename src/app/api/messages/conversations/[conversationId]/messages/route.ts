import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth/jwt';
import { isUuid } from '@/lib/storage/public-url';
import { isConversationParticipant } from '@/lib/messages/access';
import { sendNotification } from '@/lib/notifications/helper';

export const runtime = 'nodejs';

type Context = { params: Promise<{ conversationId: string }> };

async function authenticate(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const payload = await verifyToken(authHeader.slice(7));
  return payload?.userId || null;
}

/** GET /api/messages/conversations/:id/messages - recent participant-only messages. */
export async function GET(request: NextRequest, context: Context) {
  const { conversationId } = await context.params;
  if (!isUuid(conversationId)) {
    return NextResponse.json({ error: 'Invalid conversation id' }, { status: 400 });
  }
  const userId = await authenticate(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!(await isConversationParticipant(conversationId, userId))) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  try {
    const requestedLimit = Number(request.nextUrl.searchParams.get('limit') || '100');
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.floor(requestedLimit), 1), 200)
      : 100;

    const result = await query(
      `SELECT m.id, m.body, m.created_at, m.sender_id, u.username AS sender_username,
              u.avatar_url AS sender_avatar
         FROM (
           SELECT id, body, created_at, sender_id
             FROM conversation_messages
            WHERE conversation_id = $1
            ORDER BY created_at DESC, id DESC
            LIMIT $2
         ) m
         LEFT JOIN users u ON u.id = m.sender_id
        ORDER BY m.created_at ASC, m.id ASC`,
      [conversationId, limit]
    );

    return NextResponse.json({
      success: true,
      messages: result.rows.map((row: Record<string, any>) => ({
        id: row.id,
        body: row.body,
        createdAt: row.created_at,
        senderId: row.sender_id,
        senderUsername: row.sender_username || 'Former member',
        senderAvatarUrl: row.sender_avatar || null,
        isMine: row.sender_id === userId,
      })),
    });
  } catch (error) {
    console.error('List messages error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** POST /api/messages/conversations/:id/messages - send a message. */
export async function POST(request: NextRequest, context: Context) {
  const { conversationId } = await context.params;
  if (!isUuid(conversationId)) {
    return NextResponse.json({ error: 'Invalid conversation id' }, { status: 400 });
  }
  const userId = await authenticate(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!(await isConversationParticipant(conversationId, userId))) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  try {
    const body = (await request.json()) as { body?: unknown };
    const message = typeof body.body === 'string' ? body.body.trim() : '';
    if (!message || message.length > 2000) {
      return NextResponse.json(
        { error: 'Message must be between 1 and 2000 characters' },
        { status: 400 }
      );
    }

    const inserted = await query(
      `INSERT INTO conversation_messages (conversation_id, sender_id, body)
       VALUES ($1, $2, $3)
       RETURNING id, body, created_at, sender_id`,
      [conversationId, userId, message]
    );

    await query('UPDATE conversations SET updated_at = NOW() WHERE id = $1', [conversationId]);

    const sender = await query('SELECT username FROM users WHERE id = $1', [userId]);
    const recipients = await query(
      'SELECT user_id FROM conversation_participants WHERE conversation_id = $1 AND user_id <> $2',
      [conversationId, userId]
    );

    for (const recipient of recipients.rows) {
      void sendNotification(
        recipient.user_id,
        'message',
        'New message',
        `${sender.rows[0]?.username || 'Someone'} sent you a message`,
        { conversationId, messageId: inserted.rows[0].id }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: {
          id: inserted.rows[0].id,
          body: inserted.rows[0].body,
          createdAt: inserted.rows[0].created_at,
          senderId: inserted.rows[0].sender_id,
          senderUsername: sender.rows[0]?.username || 'You',
          isMine: true,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
