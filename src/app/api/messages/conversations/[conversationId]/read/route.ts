import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth/jwt';
import { isUuid } from '@/lib/storage/public-url';
import { isConversationParticipant } from '@/lib/messages/access';

export const runtime = 'nodejs';

type Context = { params: Promise<{ conversationId: string }> };

/** POST /api/messages/conversations/:id/read - mark a conversation as read. */
export async function POST(request: NextRequest, context: Context) {
  const { conversationId } = await context.params;
  if (!isUuid(conversationId)) {
    return NextResponse.json({ error: 'Invalid conversation id' }, { status: 400 });
  }
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const payload = await verifyToken(authHeader.slice(7));
  if (!payload) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
  if (!(await isConversationParticipant(conversationId, payload.userId))) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  try {
    await query(
      `UPDATE conversation_participants
          SET last_read_at = NOW()
        WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, payload.userId]
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Mark conversation read error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
