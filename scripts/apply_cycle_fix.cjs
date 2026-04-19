const { Client } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });

const client = new Client({
  host: 'db.raxjzfvunjxqbxswuipp.supabase.co',
  port: 5432, database: 'postgres', user: 'postgres',
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();

  // 1. Apply the migration
  const sql = fs.readFileSync('supabase/migrations/20260412120000_fix_admin_create_news_task_cycle_assignment.sql', 'utf8');
  console.log('Applying migration...');
  await client.query(sql);
  console.log('Migration applied successfully.\n');

  // 2. Verify the fix — check what cycle_start_at would be assigned now
  const { rows: cycle } = await client.query(`SELECT * FROM get_weekly_cycle_window(NOW(), 0)`);
  console.log('Current cycle:', JSON.stringify(cycle[0], null, 2));

  // 3. Check current state of open tasks
  const { rows: stats } = await client.query(`
    SELECT cycle_number, COUNT(*) as open_count
    FROM news_tasks
    WHERE consensus_status = 'open' AND consensus_reached = false
    GROUP BY cycle_number ORDER BY cycle_number
  `);
  console.log('\nOpen tasks by cycle:');
  stats.forEach(r => console.log(`  cycle#${r.cycle_number}: ${r.open_count} open`));

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
