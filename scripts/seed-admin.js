#!/usr/bin/env node

/**
 * Seed Admin User Script
 * Creates or updates the default admin user with all privileges
 */

const { execSync } = require('child_process');
const bcrypt = require('bcryptjs');

const DB_NAME = process.env.DB_NAME || 'musicapp';
const DB_USER = process.env.DB_USER || 'musicuser';

// Default admin credentials
const ADMIN_USERNAME = 'admin';
const ADMIN_EMAIL = 'admin@p2pmusic.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123!';

console.log('=================================');
console.log('Admin User Seed Script');
console.log('=================================\n');

async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

async function runPsql(sql, description) {
  try {
    execSync(`psql -U ${DB_USER} -d ${DB_NAME} -c "${sql}"`, {
      stdio: 'inherit',
    });
    if (description) console.log(`✓ ${description}`);
    return true;
  } catch (error) {
    try {
      console.log(`  Retrying with postgres user...`);
      execSync(`sudo -u postgres psql -d ${DB_NAME} -c "${sql}"`, {
        stdio: 'inherit',
      });
      if (description) console.log(`✓ ${description}`);
      return true;
    } catch (finalError) {
      console.error(`✗ Failed: ${finalError.message}`);
      return false;
    }
  }
}

async function seedAdmin() {
  console.log('Setting up admin user...\n');

  try {
    // Generate hashed password
    const hashedPassword = await hashPassword(ADMIN_PASSWORD);
    console.log('✓ Password hashed successfully');

    // Upsert admin user with all privileges
    const upsertSQL = `
      INSERT INTO users (
        username,
        email,
        password,
        role,
        is_superadmin,
        badge,
        is_artist,
        can_upload,
        onboarding_completed,
        is_founder_user,
        trust_score,
        artist_verified
      ) VALUES (
        '${ADMIN_USERNAME}',
        '${ADMIN_EMAIL}',
        '${hashedPassword}',
        'superadmin',
        TRUE,
        'Platform Administrator',
        TRUE,
        TRUE,
        TRUE,
        TRUE,
        100,
        TRUE
      )
      ON CONFLICT (username) DO UPDATE SET
        email = EXCLUDED.email,
        password = EXCLUDED.password,
        role = EXCLUDED.role,
        is_superadmin = EXCLUDED.is_superadmin,
        badge = EXCLUDED.badge,
        is_artist = EXCLUDED.is_artist,
        can_upload = EXCLUDED.can_upload,
        onboarding_completed = EXCLUDED.onboarding_completed,
        is_founder_user = EXCLUDED.is_founder_user,
        trust_score = EXCLUDED.trust_score,
        artist_verified = EXCLUDED.artist_verified,
        updated_at = NOW();
    `;

    await runPsql(upsertSQL, 'Admin user created/updated');

    // Verify the admin user
    const verifySQL = `
      SELECT id, username, email, role, is_superadmin, can_upload
      FROM users
      WHERE username = '${ADMIN_USERNAME}';
    `;

    console.log('\n--- Admin User Details ---');
    execSync(`psql -U ${DB_USER} -d ${DB_NAME} -c "${verifySQL}"`, {
      stdio: 'inherit',
    });

    console.log('\n=================================');
    console.log('✅ Admin user setup completed!');
    console.log('=================================');
    console.log(`\nAdmin Credentials:`);
    console.log(`   Username: ${ADMIN_USERNAME}`);
    console.log(`   Email: ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
    console.log(`\n⚠️  Change the password after first login!`);
    console.log(`   Set ADMIN_PASSWORD env var to customize.\n`);

  } catch (error) {
    console.error('\n✗ Error seeding admin user:', error.message);
    process.exit(1);
  }
}

// Check if PostgreSQL is running
try {
  execSync('pg_isready -q', { stdio: 'inherit' });
  console.log('✓ PostgreSQL is running\n');
} catch (error) {
  console.error('✗ PostgreSQL is not running. Please start PostgreSQL first.');
  process.exit(1);
}

seedAdmin();
