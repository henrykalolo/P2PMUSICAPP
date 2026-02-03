/**
 * Notification helper functions
 * Provides utility functions for managing notifications
 */

import { query } from '@/lib/db';

// Store active SSE connections
const connections = new Map<string, Set<ReadableStreamDefaultController>>();

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, any>;
  read: boolean;
  createdAt: Date;
}

export async function sendNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  data: Record<string, any> = {}
): Promise<{ success: boolean; notificationId?: string; error?: any }> {
  try {
    const result = await query(`
      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, created_at
    `, [userId, type, title, message, JSON.stringify(data)]);

    const notification: Notification = {
      id: result.rows[0].id,
      type,
      title,
      message,
      data,
      read: false,
      createdAt: result.rows[0].created_at
    };

    // Send to all SSE connections for this user
    const userConnections = connections.get(userId);
    if (userConnections) {
      const messageData = `data: ${JSON.stringify({ type: 'notification', notification })}\n\n`;
      userConnections.forEach(controller => {
        try {
          controller.enqueue(messageData);
        } catch (error) {
          // Connection closed, remove it
          userConnections.delete(controller);
        }
      });
    }

    return { success: true, notificationId: result.rows[0].id };
  } catch (error) {
    console.error('Failed to send notification:', error);
    return { success: false, error };
  }
}

export async function notifyComment(
  postId: string,
  postTitle: string,
  authorId: string,
  commenterUsername: string,
  commentContent: string
): Promise<{ success: boolean; notificationId?: string; error?: any }> {
  const message = `${commenterUsername} commented on "${postTitle}": ${commentContent.substring(0, 50)}${commentContent.length > 50 ? '...' : ''}`;
  return sendNotification(
    authorId,
    'comment',
    'New Comment',
    message,
    { postId, commenterUsername }
  );
}

export async function notifyFollow(
  userId: string,
  followerUsername: string,
  followerAvatarUrl?: string
): Promise<{ success: boolean; notificationId?: string; error?: any }> {
  const message = `${followerUsername} started following you`;
  return sendNotification(
    userId,
    'follow',
    'New Follower',
    message,
    { followerUsername, followerAvatarUrl }
  );
}

export async function notifyLike(
  postId: string,
  postTitle: string,
  authorId: string,
  likerUsername: string
): Promise<{ success: boolean; notificationId?: string; error?: any }> {
  const message = `${likerUsername} liked your track "${postTitle}"`;
  return sendNotification(
    authorId,
    'like',
    'New Like',
    message,
    { postId, likerUsername }
  );
}

export function addConnection(userId: string, controller: ReadableStreamDefaultController): void {
  if (!connections.has(userId)) {
    connections.set(userId, new Set());
  }
  connections.get(userId)!.add(controller);
}

export function removeConnection(userId: string, controller: ReadableStreamDefaultController): void {
  connections.get(userId)?.delete(controller);
  if (connections.get(userId)?.size === 0) {
    connections.delete(userId);
  }
}

export function getConnections(): Map<string, Set<ReadableStreamDefaultController>> {
  return connections;
}
