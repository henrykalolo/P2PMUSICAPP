const { query } = require('./lib/db');

async function migrate() {
  try {
    console.log('Starting playlist migration...');

    // Check if playlists table exists
    const playlistsCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'playlists'
      )
    `);

    if (!playlistsCheck.rows[0].exists) {
      console.log('Creating playlists table...');
      await query(`
        CREATE TABLE playlists (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          is_public BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('Playlists table created');
    } else {
      console.log('Playlists table already exists');
    }

    // Check if playlist_tracks table exists
    const playlistTracksCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'playlist_tracks'
      )
    `);

    if (!playlistTracksCheck.rows[0].exists) {
      console.log('Creating playlist_tracks table...');
      await query(`
        CREATE TABLE playlist_tracks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
          track_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
          position INTEGER NOT NULL DEFAULT 0,
          added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(playlist_id, track_id)
        )
      `);
      console.log('Playlist_tracks table created');
    } else {
      console.log('Playlist_tracks table already exists');
    }

    // Check if parent_id column exists in comments table
    const commentsCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'comments' AND column_name = 'parent_id'
      )
    `);

    if (!commentsCheck.rows[0].exists) {
      console.log('Adding parent_id column to comments table...');
      await query(`
        ALTER TABLE comments 
        ADD COLUMN parent_id UUID REFERENCES comments(id) ON DELETE CASCADE
      `);
      console.log('parent_id column added');
    } else {
      console.log('parent_id column already exists in comments table');
    }

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
