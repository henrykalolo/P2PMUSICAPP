#!/usr/bin/env node

/**
 * Migration: Create Phase 4 Monetization Tables
 *
 * This migration adds:
 * 1. token_transactions - Ledger for token economy
 * 2. user_balances - Aggregated currency balances
 * 3. balance_transactions - Fiat/crypto transaction ledger
 * 4. subscriptions - Artist subscription tiers
 * 5. subscriber_features - Granted subscriber features
 * 6. tips - Direct artist support (tips)
 * 7. payouts - Artist revenue withdrawals
 * 8. transactions - General monetization ledger
 * 9. token_distributions - Batch reward distributions
 * 10. artist_settings - Payout preferences
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  try {
    console.log('Starting Phase 4 monetization migration...');

    const schemaPath = path.join(__dirname, '..', 'src', 'lib', 'db', 'monetization-schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    await pool.query(schema);
    console.log('Monetization schema applied successfully');

    // Verify key tables were created
    const tables = [
      'token_transactions',
      'user_balances',
      'balance_transactions',
      'subscriptions',
      'subscriber_features',
      'tips',
      'payouts',
      'transactions',
      'token_distributions',
      'artist_settings',
    ];

    for (const table of tables) {
      const result = await pool.query(
        `SELECT EXISTS (
           SELECT FROM information_schema.tables WHERE table_name = $1
         )`,
        [table]
      );
      if (result.rows[0].exists) {
        console.log(`  ✓ ${table}`);
      } else {
        console.error(`  ✗ ${table} - FAILED TO CREATE`);
      }
    }

    console.log('\nMigration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
