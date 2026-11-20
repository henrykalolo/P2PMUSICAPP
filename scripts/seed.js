#!/usr/bin/env node

/**
 * Remove demo content while preserving administrator accounts.
 * Uses DATABASE_URL and the pg client (no psql/sudo dependency).
 */

const readline = require('readline');
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const pool = new Pool({ connectionString });

const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
prompt.question(
  'This deletes all posts, interactions, and non-admin users. Type YES to continue: ',
  async (answer) => {
    prompt.close();
    if (answer !== 'YES') {
      console.log('Cancelled.');
      await pool.end();
      return;
    }

    try {
      await pool.query('BEGIN');
      const tables = [
        'group_posts', 'group_members', 'groups',
        'playlist_tracks', 'playlists',
        'swarm_participation', 'swarm_members', 'swarms',
        'reposts', 'comments', 'likes', 'posts',
        'music_preferences', 'follows', 'user_stats', 'webauthn_credentials',
        'notifications', 'user_chunks',
      ];
      for (const table of tables) {
        await pool.query(`DELETE FROM ${table}`);
      }
      await pool.query('DELETE FROM users WHERE is_superadmin = FALSE');
      await pool.query('COMMIT');
      console.log('✓ Demo data removed; administrator accounts preserved.');
    } catch (error) {
      await pool.query('ROLLBACK');
      console.error(`✗ Cleanup failed: ${error.message}`);
      process.exitCode = 1;
    } finally {
      await pool.end();
    }
  }
);
