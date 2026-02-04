/**
 * Migration: Add server storage support
 * 
 * This migration adds:
 * 1. server_storage_id column to posts table
 * 2. Updates storage_type to include 'server' option
 * 3. Adds indexes for efficient queries
 * 
 * Run with: node scripts/migrate-add-server-storage-id.js
 */

import pg from 'pg';
const { Client } = pg;

async function migrate() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/p2pmusic',
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Begin transaction
    await client.query('BEGIN');

    // 1. Add server_storage_id column to posts table if not exists
    console.log('Adding server_storage_id column...');
    await client.query(`
      ALTER TABLE posts 
      ADD COLUMN IF NOT EXISTS server_storage_id VARCHAR(255)
    `);

    // 2. Update storage_type CHECK constraint to include 'server'
    console.log('Updating storage_type constraint...');
    
    // Drop existing constraint if exists
    try {
      await client.query(`
        ALTER TABLE posts 
        DROP CONSTRAINT IF EXISTS posts_storage_type_check
      `);
    } catch (e) {
      // Constraint might not exist
    }

    // Add updated constraint
    await client.query(`
      ALTER TABLE posts 
      ADD CONSTRAINT posts_storage_type_check 
      CHECK (storage_type IN ('ipfs', 'torrent', 'hybrid', 'server'))
    `);

    // 3. Add index for server_storage_id
    console.log('Creating index for server_storage_id...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_posts_server_storage_id 
      ON posts(server_storage_id) 
      WHERE server_storage_id IS NOT NULL
    `);

    // 4. Add index for instantReady tracks (server storage)
    console.log('Creating index for instant ready tracks...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_posts_instant_ready 
      ON posts(created_at DESC) 
      WHERE storage_type = 'server'
    `);

    // 5. Add column for instantReady tracking
    console.log('Adding instant_ready column...');
    await client.query(`
      ALTER TABLE posts 
      ADD COLUMN IF NOT EXISTS instant_ready BOOLEAN DEFAULT FALSE
    `);

    // Commit transaction
    await client.query('COMMIT');
    console.log('Migration completed successfully!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
