#!/usr/bin/env node

/**
 * Database setup.
 *
 * Reads DATABASE_URL (environment or .env.local / .env), verifies connectivity,
 * and applies the canonical schema. Cross-platform: uses the pg client, not
 * shelling out to psql/sudo.
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

function loadEnvFile(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
  return env;
}

const root = path.join(__dirname, '..');
const fileEnv = {
  ...loadEnvFile(path.join(root, '.env')),
  ...loadEnvFile(path.join(root, '.env.local')),
};

const connectionString = process.env.DATABASE_URL || fileEnv.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is not set. Add it to .env.local and try again.');
  process.exit(1);
}

if (/localhost|127\.0\.0\.1/.test(connectionString) &&
    /(yourpassword|password:password|user:password)/.test(connectionString)) {
  console.error('DATABASE_URL still contains placeholder credentials. Update .env.local.');
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function main() {
  console.log('Checking database connectivity...');
  try {
    const result = await pool.query('SELECT 1 AS ok');
    if (!result.rows[0]?.ok) throw new Error('unexpected response');
    console.log('✓ Connected to PostgreSQL');
  } catch (error) {
    console.error(`✗ Cannot connect: ${error.message}`);
    console.error('  Create the database and user first, then set DATABASE_URL.');
    process.exitCode = 1;
    return;
  }

  try {
    const schema = fs.readFileSync(path.join(root, 'src', 'lib', 'db', 'schema.sql'), 'utf8');
    console.log('Applying canonical schema...');
    await pool.query(schema);
    console.log('✓ Schema applied (idempotent)');
  } catch (error) {
    console.error(`✗ Migration failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
