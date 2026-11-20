-- ============================================================
-- P2P Music Platform - Canonical Schema
-- ============================================================
-- This file is the single source of truth for the database.
-- It is idempotent and can be re-run safely.
-- Run as the application database user (see scripts/setup-db.js).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------
-- Identity & profiles
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  password TEXT,
  avatar_url TEXT,
  trust_score INT NOT NULL DEFAULT 0,
  badge TEXT NOT NULL DEFAULT 'Newbie',
  is_artist BOOLEAN NOT NULL DEFAULT TRUE,
  can_upload BOOLEAN NOT NULL DEFAULT FALSE,
  daily_upload_quota BIGINT NOT NULL DEFAULT 104857600,
  total_upload_quota BIGINT NOT NULL DEFAULT 10737418240,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'superadmin')),
  is_superadmin BOOLEAN NOT NULL DEFAULT FALSE,
  artist_bio TEXT,
  artist_genres TEXT[] NOT NULL DEFAULT '{}',
  artist_verified BOOLEAN NOT NULL DEFAULT FALSE,
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  music_preferences_selected INT NOT NULL DEFAULT 0,
  users_followed_count INT NOT NULL DEFAULT 0,
  is_founder_user BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS music_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  preference_type TEXT NOT NULL CHECK (preference_type IN ('genre', 'artist', 'mood', 'era')),
  preference_value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, preference_type, preference_value)
);

CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter INT NOT NULL DEFAULT 0,
  device_type TEXT,
  backed_up BOOLEAN NOT NULL DEFAULT FALSE,
  transports TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Social graph
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS follows (
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_mutual BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
CREATE INDEX IF NOT EXISTS idx_mutual_gating ON follows(follower_id, is_mutual) WHERE is_mutual = TRUE;

-- Mutual-status trigger. Dollar quoting is $$ (not $) and the keyword is EXECUTE.
CREATE OR REPLACE FUNCTION update_mutual_status()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE follows
     SET is_mutual = TRUE
   WHERE ((follower_id = NEW.follower_id AND following_id = NEW.following_id)
       OR (follower_id = NEW.following_id AND following_id = NEW.follower_id));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_mutual_check ON follows;
CREATE TRIGGER trigger_mutual_check
  AFTER INSERT ON follows
  FOR EACH ROW EXECUTE FUNCTION update_mutual_status();

-- ------------------------------------------------------------
-- Content
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS albums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  artist TEXT,
  description TEXT,
  genre TEXT,
  release_date DATE,
  cover_art_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_albums_owner ON albums(owner_id);
CREATE INDEX IF NOT EXISTS idx_albums_release_date ON albums(release_date DESC);

CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  artist TEXT,
  album TEXT,
  genre TEXT,
  year INT,
  duration_seconds INT,
  bitrate INT,
  -- Legacy P2P identifiers (kept for older clients)
  magnet_uri TEXT,
  info_hash VARCHAR(40) UNIQUE,
  -- IPFS identifiers
  ipfs_cid VARCHAR(64),
  ipfs_metadata_cid VARCHAR(64),
  ipfs_gateway_url TEXT,
  -- Primary object-store location
  storage_type VARCHAR(10) NOT NULL DEFAULT 'server'
    CHECK (storage_type IN ('ipfs', 'torrent', 'hybrid', 'server')),
  server_storage_id VARCHAR(255),
  file_size BIGINT,
  mime_type TEXT,
  -- Encryption at rest: IV is stored; key is wrapped by the server master key
  is_encrypted BOOLEAN NOT NULL DEFAULT FALSE,
  encryption_iv BYTEA,
  encryption_alg TEXT NOT NULL DEFAULT 'aes-256-gcm',
  cover_art_url TEXT,
  description TEXT,
  album_id UUID REFERENCES albums(id) ON DELETE SET NULL,
  play_count BIGINT NOT NULL DEFAULT 0,
  share_count BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Existing installations predate these columns.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS album_id UUID REFERENCES albums(id) ON DELETE SET NULL;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS play_count BIGINT NOT NULL DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS share_count BIGINT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_genre ON posts(genre);
CREATE INDEX IF NOT EXISTS idx_posts_ipfs_cid ON posts(ipfs_cid) WHERE ipfs_cid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_server_storage_id ON posts(server_storage_id) WHERE server_storage_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_author_storage ON posts(author_id, storage_type);

CREATE TABLE IF NOT EXISTS likes (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_likes_post ON likes(post_id);

CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  timestamp_seconds INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);

CREATE TABLE IF NOT EXISTS reposts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, post_id)
);

-- Listening telemetry used for analytics, recently played and discovery ranking.
CREATE TABLE IF NOT EXISTS play_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('play', 'complete', 'skip')),
  client_event_id TEXT UNIQUE,
  progress_seconds INT NOT NULL DEFAULT 0,
  duration_seconds INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_play_events_user_created ON play_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_play_events_post_created ON play_events(post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_play_events_post_type ON play_events(post_id, event_type);

CREATE TABLE IF NOT EXISTS playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS playlist_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (playlist_id, track_id)
);

-- ------------------------------------------------------------
-- Private groups
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  group_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS group_posts (
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, group_id)
);

-- ------------------------------------------------------------
-- Reputation & notifications
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_stats (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  total_uploaded BIGINT NOT NULL DEFAULT 0,
  total_downloaded BIGINT NOT NULL DEFAULT 0,
  upload_ratio FLOAT NOT NULL DEFAULT 0,
  session_count INT NOT NULL DEFAULT 0,
  total_session_duration INT NOT NULL DEFAULT 0,
  avg_session_duration FLOAT NOT NULL DEFAULT 0,
  successful_verifications INT NOT NULL DEFAULT 0,
  total_verifications INT NOT NULL DEFAULT 0,
  hash_verification_rate FLOAT NOT NULL DEFAULT 0,
  mutual_connections INT NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  info_hash TEXT NOT NULL,
  chunk_hash TEXT NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, info_hash, chunk_hash)
);

CREATE INDEX IF NOT EXISTS idx_user_chunks_user_hash ON user_chunks(user_id, info_hash);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- ------------------------------------------------------------
-- Direct messages
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversation_participants (
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_participants_user
  ON conversation_participants(user_id, joined_at DESC);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_created
  ON conversation_messages(conversation_id, created_at DESC);

-- ------------------------------------------------------------
-- Swarm bookkeeping (optional P2P acceleration layer)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS swarms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id VARCHAR(255) NOT NULL UNIQUE,
  content_type VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  member_count INT NOT NULL DEFAULT 1,
  total_size BIGINT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS swarm_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  swarm_id UUID NOT NULL REFERENCES swarms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'leecher',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  bytes_uploaded BIGINT NOT NULL DEFAULT 0,
  bytes_downloaded BIGINT NOT NULL DEFAULT 0,
  reputation_score INT NOT NULL DEFAULT 0,
  is_online BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (swarm_id, user_id)
);

CREATE TABLE IF NOT EXISTS swarm_participation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  swarm_id UUID NOT NULL REFERENCES swarms(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'leecher',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_ping_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_upload_bytes BIGINT NOT NULL DEFAULT 0,
  total_download_bytes BIGINT NOT NULL DEFAULT 0,
  availability_score FLOAT NOT NULL DEFAULT 0,
  UNIQUE (user_id, swarm_id)
);

CREATE INDEX IF NOT EXISTS idx_swarms_content ON swarms(content_id);
CREATE INDEX IF NOT EXISTS idx_swarms_content_type ON swarms(content_type);
CREATE INDEX IF NOT EXISTS idx_swarm_members_swarm ON swarm_members(swarm_id);
CREATE INDEX IF NOT EXISTS idx_swarm_members_user ON swarm_members(user_id);
CREATE INDEX IF NOT EXISTS idx_swarm_participation_user ON swarm_participation(user_id);
CREATE INDEX IF NOT EXISTS idx_swarm_participation_swarm ON swarm_participation(swarm_id);

-- ============================================================
-- No PUBLIC grants: the application role owns these objects.
-- Create an administrator explicitly with scripts/seed-admin.js.
-- ============================================================
