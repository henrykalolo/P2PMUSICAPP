/**
 * Pure SQL builders for personalized mixes. Kept separate from the route so the
 * filter combinations (genre preferences OR followed artists) can be tested.
 */

export interface AutoPlaylistQueryInput {
  viewerId: string;
  /** Preferred genre names from music_preferences. */
  preferences: string[];
  /** User ids the viewer follows. */
  followingIds: string[];
  limit: number;
  randomize: boolean;
  /** Own uploads are excluded by default so the mix feels like discovery. */
  includeOwn?: boolean;
}

export interface QueryBuildResult {
  sql: string;
  params: unknown[];
}

const SELECT_COLUMNS = `
      SELECT DISTINCT
        p.id,
        p.title,
        p.artist,
        p.album,
        p.genre,
        p.duration_seconds,
        p.cover_art_url,
        p.storage_type,
        p.server_storage_id,
        p.ipfs_cid,
        p.created_at,
        u.id as author_id,
        u.username as author_username,
        u.avatar_url as author_avatar,
        COUNT(DISTINCT l.user_id) as likes_count,
        COUNT(DISTINCT c.id) as comments_count
      FROM posts p
      JOIN users u ON p.author_id = u.id
      LEFT JOIN likes l ON p.id = l.post_id
      LEFT JOIN comments c ON p.id = c.post_id
      WHERE 1=1
`;

const GROUP_AND_ORDER = `
      GROUP BY p.id, p.title, p.artist, p.album, p.genre, p.duration_seconds,
               p.cover_art_url, p.storage_type, p.server_storage_id, p.ipfs_cid, p.created_at,
               u.id, u.username, u.avatar_url
`;

/** Build the query for a personalized mix. */
export function buildAutoPlaylistQuery(input: AutoPlaylistQueryInput): QueryBuildResult {
  const params: unknown[] = [];
  let sql = SELECT_COLUMNS;

  if (!input.includeOwn) {
    params.push(input.viewerId);
    sql += ` AND p.author_id != $${params.length}`;
  }

  const interests: string[] = [];
  if (input.preferences.length > 0) {
    params.push(input.preferences);
    interests.push(`p.genre = ANY($${params.length}::text[])`);
  }
  if (input.followingIds.length > 0) {
    params.push(input.followingIds);
    interests.push(`p.author_id = ANY($${params.length}::uuid[])`);
  }
  if (interests.length > 0) {
    // Preferences and follows are alternative signals, not cumulative filters.
    sql += ` AND (${interests.join(' OR ')})`;
  }

  sql += GROUP_AND_ORDER;
  sql += input.randomize
    ? ` ORDER BY RANDOM()`
    : ` ORDER BY COUNT(DISTINCT l.user_id) DESC, p.created_at DESC`;

  params.push(Math.max(1, Math.min(50, Math.floor(input.limit) || 20)));
  sql += ` LIMIT $${params.length}`;

  return { sql, params };
}

/**
 * Fallback used when the personal signals return nothing: popular recent
 * uploads from other listeners. A mix should never be empty just because a new
 * user has not liked or followed anything yet.
 */
export function buildAutoPlaylistFallbackQuery(viewerId: string, limit: number): QueryBuildResult {
  const params: unknown[] = [viewerId];
  const sql = `${SELECT_COLUMNS}
      AND p.author_id != $1
      ${GROUP_AND_ORDER}
      ORDER BY COUNT(DISTINCT l.user_id) DESC, p.created_at DESC
      LIMIT $2
  `;
  params.push(Math.max(1, Math.min(50, Math.floor(limit) || 20)));
  return { sql, params };
}
