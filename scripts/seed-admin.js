#!/usr/bin/env node

/**
 * Create or update a superadmin account.
 *
 * ADMIN_PASSWORD must be supplied explicitly. No weak default is provided.
 */

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const password = process.env.ADMIN_PASSWORD;
if (!password || password.length < 12) {
  console.error('ADMIN_PASSWORD must be set and at least 12 characters long.');
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const username = process.env.ADMIN_USERNAME || 'admin';
const email = process.env.ADMIN_EMAIL || 'admin@localhost';
const pool = new Pool({ connectionString });

async function main() {
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    await pool.query(
      `INSERT INTO users (
         username, email, password, role, is_superadmin, badge, is_artist,
         can_upload, onboarding_completed, is_founder_user, trust_score, artist_verified
       ) VALUES ($1, $2, $3, 'superadmin', TRUE, 'Platform Administrator', TRUE,
                 TRUE, TRUE, TRUE, 100, TRUE)
       ON CONFLICT (username) DO UPDATE SET
         email = EXCLUDED.email,
         password = EXCLUDED.password,
         role = EXCLUDED.role,
         is_superadmin = EXCLUDED.is_superadmin,
         updated_at = NOW()`,
      [username, email, passwordHash]
    );
    console.log(`✓ Superadmin "${username}" is ready`);
  } catch (error) {
    console.error(`✗ Failed to seed admin: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
