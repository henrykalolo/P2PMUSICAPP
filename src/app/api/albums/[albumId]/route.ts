import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth/jwt';
import { createTrackStreamUrl } from '@/lib/media/signed-url';
import { isUuid } from '@/lib/storage/public-url';

export const runtime = 'nodejs';

type Context = { params: Promise<{ albumId: string }> };

/** GET /api/albums/:albumId - album metadata plus its tracks. */
export async function GET(_request: NextRequest, context: Context) {
  const { albumId } = await context.params;
  if (!isUuid(albumId)) {
    return NextResponse.json({ error: 'Invalid album id' }, { status: 400 });
  }

  try {
    const albumResult = await query(
      `SELECT a.*, u.username AS owner_username,
              (SELECT COUNT(*)::int FROM posts p WHERE p.album_id = a.id) AS tracks_count
         FROM albums a JOIN users u ON u.id = a.owner_id
        WHERE a.id = $1`,
      [albumId]
    );
    const album = albumResult.rows[0] as Record<string, any> | undefined;
    if (!album) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }

    const tracksResult = await query(
      `SELECT p.id, p.title, p.artist, p.album, p.genre, p.duration_seconds,
              p.cover_art_url, p.storage_type, p.server_storage_id, p.ipfs_cid,
              p.play_count, p.created_at,
              u.id AS author_id, u.username AS author_username, u.avatar_url AS author_avatar,
              (SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id) AS likes_count,
              (SELECT COUNT(*)::int FROM comments c WHERE c.post_id = p.id) AS comments_count
         FROM posts p JOIN users u ON u.id = p.author_id
        WHERE p.album_id = $1
        ORDER BY p.created_at ASC`,
      [albumId]
    );

    return NextResponse.json({
      success: true,
      album: {
        id: album.id,
        title: album.title,
        artist: album.artist,
        description: album.description,
        genre: album.genre,
        releaseDate: album.release_date,
        coverArtUrl: album.cover_art_url,
        tracksCount: Number(album.tracks_count) || 0,
        createdAt: album.created_at,
        owner: { id: album.owner_id, username: album.owner_username },
      },
      tracks: tracksResult.rows.map((row: Record<string, any>) => ({
        id: row.id,
        title: row.title,
        artist: row.artist,
        album: row.album,
        genre: row.genre,
        duration: Number(row.duration_seconds) || 0,
        coverArtUrl: row.cover_art_url,
        storageType: row.storage_type,
        serverStorageId: row.server_storage_id,
        ipfsCid: row.ipfs_cid,
        streamUrl: createTrackStreamUrl(row.id, row.storage_type, row.server_storage_id, row.ipfs_cid),
        playsCount: Number(row.play_count) || 0,
        likesCount: Number(row.likes_count) || 0,
        commentsCount: Number(row.comments_count) || 0,
        createdAt: row.created_at,
        author: {
          id: row.author_id,
          username: row.author_username,
          avatarUrl: row.author_avatar,
        },
      })),
    });
  } catch (error) {
    console.error('Get album error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** DELETE /api/albums/:albumId - owner-only; tracks remain but are detached. */
export async function DELETE(request: NextRequest, context: Context) {
  const { albumId } = await context.params;
  if (!isUuid(albumId)) {
    return NextResponse.json({ error: 'Invalid album id' }, { status: 400 });
  }
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const payload = await verifyToken(authHeader.slice(7));
  if (!payload) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  try {
    const result = await query('DELETE FROM albums WHERE id = $1 AND owner_id = $2', [
      albumId,
      payload.userId,
    ]);
    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Album not found or forbidden' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete album error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
