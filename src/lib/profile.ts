import { query } from '@/lib/db';

/**
 * The authoritative profile shape used by /api/auth/me and public profiles.
 * Keeping it in one place prevents the profile pages from receiving partial
 * user objects.
 */
export interface UserProfileData {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  role: string;
  isArtist: boolean;
  canUpload: boolean;
  onboardingCompleted: boolean;
  isFounderUser: boolean;
  trustScore: number;
  badge: string;
  artistBio: string | null;
  artistGenres: string[];
  artistVerified: boolean;
  usersFollowedCount: number;
  followersCount: number;
  followingCount: number;
  tracksCount: number;
  likesCount: number;
  repostsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const PROFILE_SELECT = `
  SELECT id, username, email, avatar_url, role,
         is_artist, can_upload, onboarding_completed, is_founder_user,
         trust_score, badge, artist_bio, artist_genres, artist_verified,
         users_followed_count, created_at, updated_at
  FROM users
  WHERE id = $1
`;

function countOf(rows: Array<{ count: string | number }>): number {
  const value = rows[0]?.count ?? 0;
  return typeof value === 'number' ? value : parseInt(value, 10) || 0;
}

export function mapUserProfile(
  row: Record<string, any>,
  counts: {
    followersCount: number;
    followingCount: number;
    tracksCount: number;
    likesCount: number;
    repostsCount: number;
  }
): UserProfileData {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    avatarUrl: row.avatar_url || null,
    role: row.role,
    isArtist: Boolean(row.is_artist),
    canUpload: Boolean(row.can_upload),
    onboardingCompleted: Boolean(row.onboarding_completed),
    isFounderUser: Boolean(row.is_founder_user),
    trustScore: Number(row.trust_score) || 0,
    badge: row.badge || 'Newbie',
    artistBio: row.artist_bio || null,
    artistGenres: Array.isArray(row.artist_genres) ? row.artist_genres : [],
    artistVerified: Boolean(row.artist_verified),
    usersFollowedCount: Number(row.users_followed_count) || 0,
    followersCount: counts.followersCount,
    followingCount: counts.followingCount,
    tracksCount: counts.tracksCount,
    likesCount: counts.likesCount,
    repostsCount: counts.repostsCount,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getUserProfile(userId: string): Promise<UserProfileData | null> {
  const userResult = await query(PROFILE_SELECT, [userId]);
  const row = userResult.rows[0];
  if (!row) return null;

  const [followers, following, tracks, likes, reposts] = await Promise.all([
    query('SELECT COUNT(*) AS count FROM follows WHERE following_id = $1', [userId]),
    query('SELECT COUNT(*) AS count FROM follows WHERE follower_id = $1', [userId]),
    query('SELECT COUNT(*) AS count FROM posts WHERE author_id = $1', [userId]),
    query('SELECT COUNT(*) AS count FROM likes WHERE user_id = $1', [userId]),
    query('SELECT COUNT(*) AS count FROM reposts WHERE user_id = $1', [userId]),
  ]);

  return mapUserProfile(row, {
    followersCount: countOf(followers.rows),
    followingCount: countOf(following.rows),
    tracksCount: countOf(tracks.rows),
    likesCount: countOf(likes.rows),
    repostsCount: countOf(reposts.rows),
  });
}
