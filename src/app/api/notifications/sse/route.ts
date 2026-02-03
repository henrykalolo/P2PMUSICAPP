import { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { query } from '@/lib/db';

// Store active SSE connections
const connections = new Map<string, Set<ReadableStreamDefaultController>>();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return new Response('Unauthorized', { status: 401 });
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return new Response('Invalid token', { status: 401 });
  }

  const stream = new ReadableStream({
    start(controller) {
      // Add this connection to the set
      if (!connections.has(payload.userId)) {
        connections.set(payload.userId, new Set());
      }
      connections.get(payload.userId)!.add(controller);

      // Send initial connection message
      controller.enqueue(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

      // Set up polling for new notifications
      const pollInterval = setInterval(async () => {
        try {
          const result = await query(`
            SELECT id, type, title, message, data, created_at
            FROM notifications
            WHERE user_id = $1 AND created_at > NOW() - INTERVAL '5 seconds'
            ORDER BY created_at DESC
          `, [payload.userId]);

          if (result.rows.length > 0) {
            for (const row of result.rows) {
              const notification = {
                id: row.id,
                type: row.type,
                title: row.title,
                message: row.message,
                data: row.data,
                read: false,
                createdAt: row.created_at
              };
              controller.enqueue(`data: ${JSON.stringify({ type: 'notification', notification })}\n\n`);
            }
          }
        } catch (error) {
          console.error('Polling error:', error);
        }
      }, 5000);

      // Clean up on close
      request.signal.addEventListener('abort', () => {
        clearInterval(pollInterval);
        connections.get(payload.userId)?.delete(controller);
        if (connections.get(payload.userId)?.size === 0) {
          connections.delete(payload.userId);
        }
        controller.close();
      });
    },
    cancel() {
      // Handle client disconnect
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}
