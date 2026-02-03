#!/usr/bin/env node

/**
 * Database Seed Script
 * Removes all existing demo data and optionally seeds fresh data
 */

const { execSync } = require('child_process');

const DB_NAME = process.env.DB_NAME || 'musicapp';
const DB_USER = process.env.DB_USER || 'musicuser';

console.log('=================================');
console.log('Database Seed Script');
console.log('=================================\n');

// Helper function to run psql commands with fallback to postgres user
function runPsql(sql, description) {
  try {
    execSync(`psql -U ${DB_USER} -d ${DB_NAME} -c "${sql}"`, {
      stdio: 'inherit',
    });
    if (description) console.log(`✓ ${description}`);
    return true;
  } catch (error) {
    // Try with postgres user
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

// Check if PostgreSQL is running
try {
  execSync('pg_isready -q', { stdio: 'inherit' });
  console.log('✓ PostgreSQL is running');
} catch (error) {
  console.error('✗ PostgreSQL is not running. Please start PostgreSQL first.');
  process.exit(1);
}

// Check if database exists
try {
  execSync(`psql -U ${DB_USER} -d ${DB_NAME} -c "SELECT 1"`, {
    stdio: 'inherit',
  });
} catch (error) {
  // Try with postgres user
  try {
    execSync(`sudo -u postgres psql -l | grep -q ${DB_NAME}`, {
      stdio: 'inherit',
    });
  } catch (finalError) {
    console.error(`✗ Database '${DB_NAME}' does not exist. Run scripts/setup-db.js first.`);
    process.exit(1);
  }
}

console.log('\n⚠️  WARNING: This will delete ALL demo data from the database!');
console.log('   - All posts, comments, likes, reposts will be removed');
console.log('   - All follows and user relationships will be removed');
console.log('   - All group memberships and group posts will be removed');
console.log('   - Music preferences will be cleared');
console.log('   - User stats will be reset');
console.log('   - The superadmin account will be preserved\n');

const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout,
});

readline.question('Are you sure you want to continue? (type "YES" to confirm): ', (answer) => {
  if (answer !== 'YES') {
    console.log('\n✗ Operation cancelled. No changes made.');
    readline.close();
    process.exit(0);
  }
  readline.close();
  
  seedDatabase();
});

function seedDatabase() {
  console.log('\n🗑️  Removing all existing demo data...\n');
  
  const deleteOperations = [
    { table: 'group_posts', sql: 'DELETE FROM group_posts', desc: 'Cleared group_posts' },
    { table: 'group_members', sql: 'DELETE FROM group_members', desc: 'Cleared group_members' },
    { table: 'groups', sql: "DELETE FROM groups WHERE name != 'superadmin'", desc: 'Cleared groups' },
    { table: 'reposts', sql: 'DELETE FROM reposts', desc: 'Cleared reposts' },
    { table: 'comments', sql: 'DELETE FROM comments', desc: 'Cleared comments' },
    { table: 'likes', sql: 'DELETE FROM likes', desc: 'Cleared likes' },
    { table: 'posts', sql: 'DELETE FROM posts', desc: 'Cleared posts' },
    { table: 'music_preferences', sql: 'DELETE FROM music_preferences', desc: 'Cleared music_preferences' },
    { table: 'follows', sql: 'DELETE FROM follows', desc: 'Cleared follows' },
    { table: 'user_stats', sql: 'DELETE FROM user_stats', desc: 'Cleared user_stats' },
    { table: 'webauthn_credentials', sql: 'DELETE FROM webauthn_credentials', desc: 'Cleared webauthn_credentials' },
    { table: 'users', sql: "DELETE FROM users WHERE username != 'superadmin'", desc: 'Cleared demo users' },
  ];

  let hasError = false;

  for (const op of deleteOperations) {
    if (!runPsql(op.sql, op.desc)) {
      hasError = true;
    }
  }

  if (hasError) {
    console.error('\n⚠️  Some operations failed. The database may be in an inconsistent state.');
    process.exit(1);
  }

  console.log('\n=================================');
  console.log('✅ Database cleanup completed successfully!');
  console.log('=================================');
  console.log('\nAll demo data has been removed.');
  console.log('The superadmin account has been preserved.');
  console.log('\nYou can now start fresh with a clean database.');
}
