#!/usr/bin/env node

/**
 * Local Database Setup Script
 * Sets up PostgreSQL database and runs migrations for local development
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DB_NAME = process.env.DB_NAME || 'musicapp';
const DB_USER = process.env.DB_USER || 'musicuser';
const DB_PASSWORD = process.env.DB_PASSWORD || 'yourpassword';

console.log('Setting up local PostgreSQL database...\n');

// Check if PostgreSQL is running
try {
  execSync('pg_isready -q', { stdio: 'inherit' });
  console.log('✓ PostgreSQL is running');
} catch (error) {
  console.error('✗ PostgreSQL is not running. Please start PostgreSQL:');
  console.error('  - Ubuntu/Debian: sudo systemctl start postgresql');
  console.error('  - macOS: brew services start postgresql');
  console.error('  - Windows: net start postgresql');
  process.exit(1);
}

// Helper function to run commands as postgres user
function runAsPostgres(command, options = {}) {
  return execSync(`sudo -u postgres ${command}`, { 
    stdio: 'inherit',
    encoding: 'utf8',
    ...options
  });
}

// Helper function to run SQL via stdin (bypasses file permission issues)
function runSqlAsPostgres(databaseName, sqlContent) {
  const proc = require('child_process').spawn('sudo', ['-u', 'postgres', 'psql', '-d', databaseName], {
    stdio: ['pipe', 'inherit', 'inherit']
  });
  proc.stdin.write(sqlContent);
  proc.stdin.end();
  return new Promise((resolve, reject) => {
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`psql exited with code ${code}`));
    });
  });
}

// Check if we can connect using postgres user
function canConnectViaPostgres() {
  try {
    runAsPostgres(`psql -d "${DB_NAME}" -c "SELECT 1"`);
    return true;
  } catch {
    return false;
  }
}

// Create database if it doesn't exist
console.log(`Checking database '${DB_NAME}'...`);
try {
  if (canConnectViaPostgres()) {
    console.log(`✓ Database '${DB_NAME}' already exists`);
  } else {
    throw new Error('Cannot connect via postgres user');
  }
} catch (error) {
  console.log(`Creating database '${DB_NAME}'...`);
  try {
    runAsPostgres(`createdb "${DB_NAME}"`);
    console.log(`✓ Database '${DB_NAME}' created`);
  } catch (createError) {
    console.error(`Failed to create database: ${createError.message}`);
    process.exit(1);
  }
}

// Create user if it doesn't exist
console.log('\nEnsuring user exists...');
try {
  runAsPostgres(`psql -c "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}';"`);
  console.log(`✓ User '${DB_USER}' already exists`);
} catch {
  console.log(`Creating user '${DB_USER}'...`);
  try {
    runAsPostgres(`psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';"`);
    runAsPostgres(`psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"`);
    console.log(`✓ User '${DB_USER}' created with postgres user`);
  } catch (createError) {
    console.error(`Failed to create user: ${createError.message}`);
    console.log('\nTrying alternative method...');
    try {
      // Try creating user directly via psql as postgres user
      execSync(`psql -U postgres -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';"`, {
        stdio: 'inherit'
      });
      execSync(`psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"`, {
        stdio: 'inherit'
      });
      console.log(`✓ User '${DB_USER}' created`);
    } catch (finalError) {
      console.error(`Failed to create user: ${finalError.message}`);
      console.log('\nPlease run the following commands manually:');
      console.log(`  sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';"`);
      console.log(`  sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"`);
      process.exit(1);
    }
  }
}

// Grant CONNECT privilege on the database
console.log('\nGranting database access...');
try {
  runAsPostgres(`psql -d "${DB_NAME}" -c "GRANT CONNECT ON DATABASE ${DB_NAME} TO ${DB_USER};"`);
  console.log(`✓ CONNECT privilege granted`);
} catch (error) {
  console.error(`Failed to grant CONNECT: ${error.message}`);
}

// Run migrations - read file content and pass via stdin
console.log('\nRunning database migrations...');
try {
  const schemaPath = path.join(__dirname, '..', 'src', 'lib', 'db', 'schema.sql');
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');
  runSqlAsPostgres(DB_NAME, schemaContent);
  console.log('✓ Migrations completed successfully');
} catch (error) {
  console.error(`Failed to run migrations: ${error.message}`);
  process.exit(1);
}

// Fix permissions - read file content and pass via stdin
console.log('\nFixing ownership and permissions...');
try {
  const fixPermissionsPath = path.join(__dirname, 'fix-permissions.sql');
  const permissionsContent = fs.readFileSync(fixPermissionsPath, 'utf8');
  runSqlAsPostgres(DB_NAME, permissionsContent);
  console.log('✓ Permissions fixed');
} catch (error) {
  console.error(`Failed to fix permissions: ${error.message}`);
  console.log('Continuing anyway...');
}

console.log('\n=================================');
console.log('Database setup completed successfully!');
console.log('=================================');
console.log(`\nYou can now start the application with:`);
console.log(`  pnpm run dev:full`);
console.log(`\nOr start services individually:`);
console.log(`  pnpm run tracker:start  # WebTorrent tracker on port 8000`);
console.log(`  pnpm run redis:start    # Redis on port 6379`);
console.log(`  pnpm run dev            # Next.js app on port 3000`);
