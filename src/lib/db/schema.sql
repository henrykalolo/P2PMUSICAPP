-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users & Profiles
-- Note: All users are artists by default (is_artist = true)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  password TEXT,
  avatar_url TEXT,
  trust_score INT DEFAULT 0,
  badge TEXT DEFAULT 'Newbie',
  is_artist BOOLEAN DEFAULT TRUE,
  can_upload BOOLEAN DEFAULT FALSE,
  daily_upload_quota BIGINT DEFAULT 104857600,
  total_upload_quota BIGINT DEFAULT 10737418240,
  role TEXT DEFAULT 'user',
  is_superadmin BOOLEAN DEFAULT FALSE,
  artist_bio TEXT,
  artist_genres TEXT[],
  artist_verified BOOLEAN DEFAULT FALSE,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  music_preferences_selected INT DEFAULT 0,
  users_followed_count INT DEFAULT 0,
  is_founder_user BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Music Preferences (Genres, Artists, Moods)
CREATE TABLE music_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  preference_type TEXT NOT NULL,
  preference_value TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, preference_type, preference_value)
);

-- Create the default superadmin user on initial setup
INSERT INTO users (
  username, 
  email, 
  role, 
  is_superadmin, 
  badge,
  is_artist,
  can_upload,
  onboarding_completed,
  is_founder_user
) VALUES (
  'superadmin',
  'admin@platform.local',
  'superadmin',
  TRUE,
  'Platform Administrator',
  TRUE,
  TRUE,
  TRUE,
  TRUE
) ON CONFLICT (username) DO NOTHING;

-- Social Graph
CREATE TABLE follows (
  follower_id UUID REFERENCES users(id),
  following_id UUID REFERENCES users(id),
  is_mutual BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id)
);

-- Index for Mutual Gating Performance
CREATE INDEX idx_mutual_gating ON follows(follower_id, is_mutual) WHERE is_mutual = TRUE;

-- Trigger to Auto-Update Mutual Status
CREATE OR REPLACE FUNCTION update_mutual_status()
RETURNS TRIGGER AS $
BEGIN
  IF EXISTS (SELECT 1 FROM follows 
             WHERE follower_id = NEW.following_id 
             AND following_id = NEW.follower_id) 
  THEN
    UPDATE follows SET is_mutual = TRUE 
    WHERE (follower_id = NEW.follower_id AND following_id = NEW.following_id)
       OR (follower_id = NEW.following_id AND following_id = NEW.follower_id);
  END IF;
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_mutual_check
AFTER INSERT ON follows
FOR EACH ROW EXUTE FUNCTION update_mutual_status();

 -- Music Posts (Torrents/IPFS/Server)
 CREATE TABLE posts (
   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
   author_id UUID REFERENCES users(id),
   title TEXT NOT NULL,
   artist TEXT,
   album TEXT,
   genre TEXT,
   year INT,
   duration_seconds INT,
   bitrate INT,
   -- P2P/WebTorrent fields (legacy support)
   magnet_uri TEXT,
   info_hash VARCHAR(40) UNIQUE,
   -- IPFS fields
   ipfs_cid VARCHAR(64),
   ipfs_metadata_cid VARCHAR(64),
   ipfs_gateway_url TEXT,
   -- Server storage fields (primary storage for instant rendering)
   server_storage_id VARCHAR(255),
   -- Storage type indicator (now includes 'server')
   storage_type VARCHAR(10) DEFAULT 'server' CHECK (storage_type IN ('ipfs', 'torrent', 'hybrid', 'server')),
   -- Instant rendering flag (true for server storage)
   instant_ready BOOLEAN DEFAULT TRUE,
   cover_art_url TEXT,
   file_size BIGINT,
   mime_type TEXT,
   created_at TIMESTAMP DEFAULT NOW()
 );

 -- Create indexes for IPFS CID lookups
 CREATE INDEX idx_posts_ipfs_cid ON posts(ipfs_cid) WHERE ipfs_cid IS NOT NULL;
 CREATE INDEX idx_posts_ipfs_metadata_cid ON posts(ipfs_metadata_cid) WHERE ipfs_metadata_cid IS NOT NULL;

 -- Create index for server storage ID lookups
 CREATE INDEX idx_posts_server_storage_id ON posts(server_storage_id) WHERE server_storage_id IS NOT NULL;

 -- Create index for instant-ready tracks (server storage)
 CREATE INDEX idx_posts_instant_ready ON posts(created_at DESC) WHERE storage_type = 'server';

 -- Create index for author-based queries
 CREATE INDEX idx_posts_author_storage ON posts(author_id, storage_type);

-- Interactions
CREATE TABLE likes (
  user_id UUID REFERENCES users(id),
  post_id UUID REFERENCES posts(id),
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES posts(id),
  user_id UUID REFERENCES users(id),
  content TEXT NOT NULL,
  timestamp_seconds INT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE reposts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  post_id UUID REFERENCES posts(id),
  caption TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Private Groups
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES users(id),
  group_key TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE group_members (
  group_id UUID REFERENCES groups(id),
  user_id UUID REFERENCES users(id),
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE group_posts (
  post_id UUID REFERENCES posts(id),
  group_id UUID REFERENCES groups(id),
  PRIMARY KEY (post_id, group_id)
);

-- WebAuthn Credentials
CREATE TABLE webauthn_credentials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter INT DEFAULT 0,
  device_type TEXT,
  backed_up BOOLEAN DEFAULT FALSE,
  transports TEXT[],
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_posts_author ON posts(author_id);
CREATE INDEX idx_posts_created ON posts(created_at DESC);
CREATE INDEX idx_posts_genre ON posts(genre);
CREATE INDEX idx_likes_post ON likes(post_id);
CREATE INDEX idx_comments_post ON comments(post_id);
CREATE INDEX idx_follows_follower ON follows(follower_id);
CREATE INDEX idx_follows_following ON follows(following_id);
CREATE INDEX idx_music_preferences_user ON music_preferences(user_id);
CREATE INDEX idx_webauthn_credentials_user ON webauthn_credentials(user_id);
CREATE INDEX idx_webauthn_credentials_credential_id ON webauthn_credentials(credential_id);

-- User Stats for Trust Score calculation
CREATE TABLE user_stats (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  total_uploaded BIGINT DEFAULT 0,
  total_downloaded BIGINT DEFAULT 0,
  upload_ratio FLOAT DEFAULT 0,
  session_count INT DEFAULT 0,
  total_session_duration INT DEFAULT 0, -- in seconds
  avg_session_duration FLOAT DEFAULT 0,
  successful_verifications INT DEFAULT 0,
  total_verifications INT DEFAULT 0,
  hash_verification_rate FLOAT DEFAULT 0,
  mutual_connections INT DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW()
);

-- Create index for trust score calculations
CREATE INDEX idx_user_stats_trust_score ON user_stats(upload_ratio, hash_verification_rate);

-- ============================================
-- GRANT PERMISSIONS FOR APPLICATION USER
-- ============================================
-- Grant SELECT on all tables to public role (for read operations)
GRANT SELECT ON users TO PUBLIC;
GRANT SELECT ON posts TO PUBLIC;
GRANT SELECT ON likes TO PUBLIC;
GRANT SELECT ON comments TO PUBLIC;
GRANT SELECT ON reposts TO PUBLIC;
GRANT SELECT ON follows TO PUBLIC;
GRANT SELECT ON music_preferences TO PUBLIC;
GRANT SELECT ON groups TO PUBLIC;
GRANT SELECT ON group_members TO PUBLIC;
GRANT SELECT ON group_posts TO PUBLIC;
GRANT SELECT ON webauthn_credentials TO PUBLIC;
GRANT SELECT ON user_stats TO PUBLIC;

-- Grant INSERT/UPDATE/DELETE on interaction tables
GRANT INSERT, UPDATE, DELETE ON likes TO PUBLIC;
GRANT INSERT, UPDATE, DELETE ON comments TO PUBLIC;
GRANT INSERT, UPDATE, DELETE ON reposts TO PUBLIC;
GRANT INSERT, UPDATE, DELETE ON follows TO PUBLIC;
GRANT INSERT, UPDATE, DELETE ON music_preferences TO PUBLIC;
GRANT INSERT, UPDATE, DELETE ON groups TO PUBLIC;
GRANT INSERT, UPDATE, DELETE ON group_members TO PUBLIC;
GRANT INSERT, UPDATE, DELETE ON group_posts TO PUBLIC;

-- Grant INSERT on posts for uploads
GRANT INSERT ON posts TO PUBLIC;

-- Grant UPDATE on users for profile updates
GRANT UPDATE ON users TO PUBLIC;

-- Grant USAGE on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA PUBLIC TO PUBLIC;

-- ============================================
-- SWARM TABLES
-- ============================================
CREATE TABLE IF NOT EXISTS swarms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id VARCHAR(255) NOT NULL,
  content_type VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  member_count INTEGER DEFAULT 1,
  total_size BIGINT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  UNIQUE(content_id)
);

CREATE TABLE IF NOT EXISTS swarm_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  swarm_id UUID NOT NULL REFERENCES swarms(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'leecher',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  bytes_uploaded BIGINT DEFAULT 0,
  bytes_downloaded BIGINT DEFAULT 0,
  reputation_score INTEGER DEFAULT 0,
  is_online BOOLEAN DEFAULT FALSE,
  UNIQUE(swarm_id, user_id)
);

CREATE TABLE IF NOT EXISTS swarm_participation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  swarm_id UUID NOT NULL REFERENCES swarms(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'leecher',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_ping_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total_upload_bytes BIGINT DEFAULT 0,
  total_download_bytes BIGINT DEFAULT 0,
  availability_score FLOAT DEFAULT 0,
  UNIQUE(user_id, swarm_id)
);

-- Indexes for swarm performance
CREATE INDEX idx_swarms_content ON swarms(content_id);
CREATE INDEX idx_swarms_content_type ON swarms(content_type);
CREATE INDEX idx_swarm_members_swarm ON swarm_members(swarm_id);
CREATE INDEX idx_swarm_members_user ON swarm_members(user_id);
CREATE INDEX idx_swarm_participation_user ON swarm_participation(user_id);
CREATE INDEX idx_swarm_participation_swarm ON swarm_participation(swarm_id);

-- Grant permissions for swarm tables
GRANT SELECT ON swarms TO PUBLIC;
GRANT SELECT ON swarm_members TO PUBLIC;
GRANT SELECT ON swarm_participation TO PUBLIC;
GRANT INSERT, UPDATE, DELETE ON swarms TO PUBLIC;
GRANT INSERT, UPDATE, DELETE ON swarm_members TO PUBLIC;
GRANT INSERT, UPDATE, DELETE ON swarm_participation TO PUBLIC;

