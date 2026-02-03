import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth/jwt';

// POST /api/social/repost - Repost a post
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

    const { postId, caption } = await request.json();

    if (!postId) {
      return NextResponse.json(
        { error: 'Post ID is required' },
        { status: 400 }
      );
    }

    const userId = payload.userId;

    // Check if post exists
    const postResult = await query(
      'SELECT id, author_id FROM posts WHERE id = $1',
      [postId]
    );

    if (postResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // Check if user already reposted this post
    const existingRepost = await query(
      'SELECT id FROM reposts WHERE user_id = $1 AND post_id = $2',
      [userId, postId]
    );

    if (existingRepost.rows.length > 0) {
      return NextResponse.json(
        { error: 'Already reposted this post' },
        { status: 409 }
      );
    }

    // Create repost
    const repostResult = await query(
      'INSERT INTO reposts (user_id, post_id, caption) VALUES ($1, $2, $3) RETURNING id, created_at',
      [userId, postId, caption || null]
    );

    // Get repost count
    const repostCountResult = await query(
      'SELECT COUNT(*) as count FROM reposts WHERE post_id = $1',
      [postId]
    );

    // Get user who created the repost
    const userResult = await query(
      'SELECT id, username, avatar_url FROM users WHERE id = $1',
      [userId]
    );

    // Get original post author
    const originalPostResult = await query(`
      SELECT p.id, p.title, p.artist, p.album, p.genre, p.duration_seconds,
             p.magnet_uri, p.ipfs_cid, p.cover_art_url, p.created_at,
             u.id as author_id, u.username as author_username, u.avatar_url as author_avatar
      FROM posts p
      JOIN users u ON p.author_id = u.id
      WHERE p.id = $1
    `, [postId]);

    return NextResponse.json({
      success: true,
      repost: {
        id: repostResult.rows[0].id,
        userId,
        postId,
        caption: caption || null,
        createdAt: repostResult.rows[0].created_at,
        user: {
          id: userResult.rows[0].id,
          username: userResult.rows[0].username,
          avatarUrl: userResult.rows[0].avatar_url
        },
        originalPost: {
          id: originalPostResult.rows[0].id,
          title: originalPostResult.rows[0].title,
          artist: originalPostResult.rows[0].artist,
          album: originalPostResult.rows[0].album,
          genre: originalPostResult.rows[0].genre,
          duration: originalPostResult.rows[0].duration_seconds,
          magnetUri: originalPostResult.rows[0].magnet_uri,
          ipfsCid: originalPostResult.rows[0].ipfs_cid,
          coverArtUrl: originalPostResult.rows[0].cover_art_url,
          createdAt: originalPostResult.rows[0].created_at,
          author: {
            id: originalPostResult.rows[0].author_id,
            username: originalPostResult.rows[0].author_username,
            avatarUrl: originalPostResult.rows[0].author_avatar
          }
        }
      },
      repostsCount: parseInt(repostCountResult.rows[0].count)
    });
  } catch (error) {
    console.error('Repost error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/social/repost - Remove repost
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

    // Check if repost exists
    const existingRepost = await query(
      'SELECT id FROM reposts WHERE user_id = $1 AND post_id = $2',
      [userId, postId]
    );

    if (existingRepost.rows.length === 0) {
      return NextResponse.json(
        { error: 'Repost not found' },
        { status: 404 }
      );
    }

    // Delete repost
    await query(
      'DELETE FROM reposts WHERE user_id = $1 AND post_id = $2',
      [userId, postId]
    );

    // Get updated repost count
    const repostCountResult = await query(
      'SELECT COUNT(*) as count FROM reposts WHERE post_id = $1',
      [postId]
    );

    return NextResponse.json({
      success: true,
      repostsCount: parseInt(repostCountResult.rows[0].count)
    });
  } catch (error) {
    console.error('Remove repost error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/social/repost/count - Get repost count for a post
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('postId');
    const userId = searchParams.get('userId');

    if (!postId) {
      return NextResponse.json(
        { error: 'Post ID is required' },
        { status: 400 }
      );
    }

    // Get repost count
    const repostCountResult = await query(
      'SELECT COUNT(*) as count FROM reposts WHERE post_id = $1',
      [postId]
    );

    let userHasReposted = false;
    if (userId) {
      const userRepostResult = await query(
        'SELECT 1 FROM reposts WHERE user_id = $1 AND post_id = $2',
        [userId, postId]
      );
      userHasReposted = userRepostResult.rows.length > 0;
    }

    return NextResponse.json({
      success: true,
      repostsCount: parseInt(repostCountResult.rows[0].count),
      userHasReposted
    });
  } catch (error) {
    console.error('Get repost count error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
