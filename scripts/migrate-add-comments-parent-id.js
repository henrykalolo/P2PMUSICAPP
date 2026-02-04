const { query } = require('./lib/db');

async function migrate() {
  try {
    // Check if parent_id column exists
    const checkResult = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'comments' AND column_name = 'parent_id'
    `);

    if (checkResult.rows.length === 0) {
      console.log('Adding parent_id column to comments table...');
      
      await query(`
        ALTER TABLE comments 
        ADD COLUMN parent_id UUID REFERENCES comments(id) ON DELETE CASCADE
      `);
      
      console.log('Successfully added parent_id column');
    } else {
      console.log('parent_id column already exists');
    }

    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
