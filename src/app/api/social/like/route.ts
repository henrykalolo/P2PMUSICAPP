import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth/jwt';
import { notifyLike } from '@/lib/notifications/helper';

// POST /api/social/like - Like a post (with badge reward system)
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

    const { postId } = await request.json();

    if (!postId) {
      return NextResponse.json(
        { error: 'Post ID is required' },
        { status: 400 }
      );
    }

    const userId = payload.userId;

    // Check if already liked
    const existingLike = await query(
      'SELECT 1 FROM likes WHERE user_id = $1 AND post_id = $2',
      [userId, postId]
    );

    if (existingLike.rows.length > 0) {
      return NextResponse.json(
        { error: 'Already liked this post' },
        { status: 409 }
      );
    }

    // Record the like
    await query(
      'INSERT INTO likes (user_id, post_id) VALUES ($1, $2)',
      [userId, postId]
    );

    // Get post and author info for notification
    const postResult = await query(
      'SELECT title, author_id FROM posts WHERE id = $1',
      [postId]
    );
    const post = postResult.rows[0];

    // Get liker info
    const likerResult = await query(
      'SELECT username FROM users WHERE id = $1',
      [userId]
    );
    const liker = likerResult.rows[0];

    // Send notification to post author (if not liking own post)
    if (post.author_id && post.author_id !== userId) {
      await notifyLike(postId, post.title, post.author_id, liker.username);
    }

    // Get updated like count
    const likeCountResult = await query(
      'SELECT COUNT(*) as count FROM likes WHERE post_id = $1',
      [postId]
    );
    const likesCount = parseInt(likeCountResult.rows[0].count);

    // Check for badge rewards
    const userLikesResult = await query(
      'SELECT COUNT(*) as count FROM likes WHERE user_id = $1',
      [userId]
    );
    const userTotalLikes = parseInt(userLikesResult.rows[0].count);

    let awardedBadge: string | null = null;
    let badgeMessage: string | null = null;

    // Badge progression system
    if (userTotalLikes === 1) {
      awardedBadge = 'First Supporter';
      badgeMessage = '🌟 You gave your first like! Welcome to the community.';
    } else if (userTotalLikes === 5) {
      awardedBadge = 'Swarm Supporter';
      badgeMessage = '🏆 Achievement Unlocked: Swarm Supporter! You\'ve liked 5 tracks. Keep supporting artists!';
    } else if (userTotalLikes === 10) {
      awardedBadge = 'Music Curator';
      badgeMessage = '🎵 Achievement Unlocked: Music Curator! You\'ve liked 10 tracks. Your taste shapes the platform!';
    } else if (userTotalLikes === 25) {
      awardedBadge = 'Trendsetter';
      badgeMessage = '🔥 Achievement Unlocked: Trendsetter! 25 likes - you\'re helping discover the next hits!';
    } else if (userTotalLikes === 50) {
      awardedBadge = 'Swarm Champion';
      badgeMessage = '👑 Achievement Unlocked: Swarm Champion! 50 likes - you\'re a pillar of the P2P music community!';
    }

    // Update user badge if earned
    if (awardedBadge) {
      await query(
        'UPDATE users SET badge = $1 WHERE id = $2',
        [awardedBadge, userId]
      );
    }

    // Get current user badge
    const userResult = await query(
      'SELECT badge FROM users WHERE id = $1',
      [userId]
    );
    const currentBadge = userResult.rows[0]?.badge;

    return NextResponse.json({
      success: true,
      liked: true,
      likesCount,
      userTotalLikes,
      awardedBadge,
      badgeMessage,
      currentBadge,
    });
  } catch (error) {
    console.error('Like error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/social/like - Unlike a post
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
    const postId = searchParams.get('postId');

    if (!postId) {
      return NextResponse.json(
        { error: 'Post ID is required' },
        { status: 400 }
      );
    }

    const userId = payload.userId;

    // Remove the like
    await query(
      'DELETE FROM likes WHERE user_id = $1 AND post_id = $2',
      [userId, postId]
    );

    // Get updated like count
    const likeCountResult = await query(
      'SELECT COUNT(*) as count FROM likes WHERE post_id = $1',
      [postId]
    );
    const likesCount = parseInt(likeCountResult.rows[0].count);

    return NextResponse.json({
      success: true,
      liked: false,
      likesCount,
    });
  } catch (error) {
    console.error('Unlike error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/social/like - Check if user liked a post
export async function GET(request: NextRequest) {
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
    const postId = searchParams.get('postId');

    if (!postId) {
      return NextResponse.json(
        { error: 'Post ID is required' },
        { status: 400 }
      );
    }

    const userId = payload.userId;

    // Check if liked
    const likeResult = await query(
      'SELECT 1 FROM likes WHERE user_id = $1 AND post_id = $2',
      [userId, postId]
    );

    const hasLiked = likeResult.rows.length > 0;

    // Get total likes for post
    const likeCountResult = await query(
      'SELECT COUNT(*) as count FROM likes WHERE post_id = $1',
      [postId]
    );
    const likesCount = parseInt(likeCountResult.rows[0].count);

    return NextResponse.json({
      success: true,
      hasLiked,
      likesCount,
    });
  } catch (error) {
    console.error('Get like status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
