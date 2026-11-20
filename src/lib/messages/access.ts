import { query } from '@/lib/db';

/** Returns true only when the user belongs to the conversation. */
export async function isConversationParticipant(
  conversationId: string,
  userId: string
): Promise<boolean> {
  const result = await query(
    'SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
    [conversationId, userId]
  );
  return (result.rowCount ?? 0) > 0;
}
