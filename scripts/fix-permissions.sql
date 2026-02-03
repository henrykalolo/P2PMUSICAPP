-- Fix database permissions script
-- Run this as postgres superuser:
--   sudo -u postgres psql -d musicapp -f scripts/fix-permissions.sql

-- Change table to musicuser
ALTER TABLE reposts OWNER TO musicuser;
ALTER SEQUENCE reposts_id_seq OWNER TO musicuser;

-- Grant all permissions on reposts to musicuser
GRANT ALL ON TABLE reposts TO musicuser;
GRANT ALL ON TABLE reposts_id_seq TO musicuser;

-- Grant SELECT on all tables to PUBLIC (for read access)
GRANT SELECT ON TABLE users TO PUBLIC;
GRANT SELECT ON TABLE posts TO PUBLIC;
GRANT SELECT ON TABLE likes TO PUBLIC;
GRANT SELECT ON TABLE comments TO PUBLIC;
GRANT SELECT ON TABLE reposts TO PUBLIC;
GRANT SELECT ON TABLE follows TO PUBLIC;
GRANT SELECT ON TABLE music_preferences TO PUBLIC;
GRANT SELECT ON TABLE groups TO PUBLIC;
GRANT SELECT ON TABLE group_members TO PUBLIC;
GRANT SELECT ON TABLE group_posts TO PUBLIC;
GRANT SELECT ON TABLE webauthn_credentials TO PUBLIC;
GRANT SELECT ON TABLE user_stats TO PUBLIC;

-- Grant INSERT/UPDATE/DELETE on interaction tables
GRANT INSERT, UPDATE, DELETE ON TABLE likes TO PUBLIC;
GRANT INSERT, UPDATE, DELETE ON TABLE comments TO PUBLIC;
GRANT INSERT, UPDATE, DELETE ON TABLE reposts TO PUBLIC;
GRANT INSERT, UPDATE, DELETE ON TABLE follows TO PUBLIC;
GRANT INSERT, UPDATE, DELETE ON TABLE music_preferences TO PUBLIC;
GRANT INSERT, UPDATE, DELETE ON TABLE groups TO PUBLIC;
GRANT INSERT, UPDATE, DELETE ON TABLE group_members TO PUBLIC;
GRANT INSERT, UPDATE, DELETE ON TABLE group_posts TO PUBLIC;

-- Grant INSERT on posts for uploads
GRANT INSERT ON TABLE posts TO PUBLIC;

-- Grant UPDATE on users for profile updates
GRANT UPDATE (username, email, avatar_url, badge, artist_bio, artist_genres, artist_verified, onboarding_completed, music_preferences_selected) ON TABLE users TO PUBLIC;

-- Grant USAGE on all sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA PUBLIC TO PUBLIC;

ALTER DEFAULT PRIVILEGES IN SCHEMA PUBLIC GRANT SELECT ON TABLES TO PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA PUBLIC GRANT INSERT, UPDATE, DELETE ON TABLES TO PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA PUBLIC GRANT USAGE ON SEQUENCES TO PUBLIC;

SELECT 'Permissions fixed successfully!' AS status;
