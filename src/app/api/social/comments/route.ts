import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth/jwt';
import { notifyComment } from '@/lib/notifications/helper';

// GET /api/social/comments?postId=xxx - Get comments for a post
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('postId');

    if (!postId) {
      return NextResponse.json(
        { error: 'Post ID is required' },
        { status: 400 }
      );
    }

    const commentsResult = await query(
      `SELECT 
        c.id,
        c.content,
        c.timestamp_seconds,
        c.created_at,
        u.id as user_id,
        u.username,
        u.avatar_url
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.post_id = $1
      ORDER BY c.created_at DESC`,
      [postId]
    );

    const comments = commentsResult.rows.map((row: any) => ({
      id: row.id,
      content: row.content,
      timestampSeconds: row.timestamp_seconds,
      createdAt: row.created_at,
      user: {
        id: row.user_id,
        username: row.username,
        avatarUrl: row.avatar_url,
      },
    }));

    return NextResponse.json({
      success: true,
      comments,
      count: comments.length,
    });
  } catch (error) {
    console.error('Get comments error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/social/comments - Add a comment to a post
export async function POST(request: NextRequest) {
  try {
    // Get token from header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token);

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const { postId, content, timestampSeconds } = await request.json();

    if (!postId || !content?.trim()) {
      return NextResponse.json(
        { error: 'Post ID and content are required' },
        { status: 400 }
      );
    }

    if (content.length > 1000) {
      return NextResponse.json(
        { error: 'Comment must be less than 1000 characters' },
        { status: 400 }
      );
    }

    const userId = payload.userId;

    // Insert comment
    const commentResult = await query(
      `INSERT INTO comments (post_id, user_id, content, timestamp_seconds)
       VALUES ($1, $2, $3, $4)
       RETURNING id, created_at`,
      [postId, userId, content.trim(), timestampSeconds || null]
    );

    // Get user info for response
    const userResult = await query(
      'SELECT username, avatar_url FROM users WHERE id = $1',
      [userId]
    );

    // Get post info for notification
    const postResult = await query(
      'SELECT title, author_id FROM posts WHERE id = $1',
      [postId]
    );
    const post = postResult.rows[0];

    // Send notification to post author (if not commenting on own post)
    if (post.author_id && post.author_id !== userId) {
      await notifyComment(postId, post.title, post.author_id, userResult.rows[0].username, content);
    }

    const comment = {
      id: commentResult.rows[0].id,
      content: content.trim(),
      timestampSeconds: timestampSeconds || null,
      createdAt: commentResult.rows[0].created_at,
      user: {
        id: userId,
        username: userResult.rows[0].username,
        avatarUrl: userResult.rows[0].avatar_url,
      },
    };

    // Get updated comment count
    const countResult = await query(
      'SELECT COUNT(*) as count FROM comments WHERE post_id = $1',
      [postId]
    );
    const commentsCount = parseInt(countResult.rows[0].count);

    return NextResponse.json({
      success: true,
      comment,
      commentsCount,
    });
  } catch (error) {
    console.error('Add comment error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/social/comments?id=xxx - Delete a comment
export async function DELETE(request: NextRequest) {
  try {
    // Get token from header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);
    const payload = await verifyToken(token);

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get('id');

    if (!commentId) {
      return NextResponse.json(
        { error: 'Comment ID is required' },
        { status: 400 }
      );
    }

    const userId = payload.userId;

    // Check if user owns the comment or is admin
    const commentResult = await query(
      'SELECT user_id, post_id FROM comments WHERE id = $1',
      [commentId]
    );

    if (commentResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Comment not found' },
        { status: 404 }
      );
    }

    const comment = commentResult.rows[0];

    // Check ownership
    if (comment.user_id !== userId && payload.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Not authorized to delete this comment' },
        { status: 403 }
      );
    }

    // Delete comment
    await query('DELETE FROM comments WHERE id = $1', [commentId]);

    // Get updated comment count
    const countResult = await query(
      'SELECT COUNT(*) as count FROM comments WHERE post_id = $1',
      [comment.post_id]
    );
    const commentsCount = parseInt(countResult.rows[0].count);

    return NextResponse.json({
      success: true,
      commentsCount,
    });
  } catch (error) {
    console.error('Delete comment error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
