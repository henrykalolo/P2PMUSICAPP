#!/usr/bin/env node

/** Apply the canonical schema. Identical to `npm run db:setup` but without connectivity preflight. */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function migrate() {
  try {
    const schema = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'lib', 'db', 'schema.sql'),
      'utf8'
    );
    console.log('Applying canonical schema...');
    await pool.query(schema);
    console.log('Migrations completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migrate();
