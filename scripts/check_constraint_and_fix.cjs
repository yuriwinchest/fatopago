const { Client } = require('pg');
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });

const client = new Client({
  host: 'db.raxjzfvunjxqbxswuipp.supabase.co',
  port: 5432, database: 'postgres', user: 'postgres',
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();

  // 1. Check the constraint
  const { rows: constraints } = await client.query(`
    SELECT conname, pg_get_constraintdef(oid) as def
    FROM pg_constraint
    WHERE conrelid = 'public.news_tasks'::regclass
    AND conname ILIKE '%manual_resolution%'
  `);
  console.log('=== CONSTRAINTS ===');
  constraints.forEach(c => console.log(`  ${c.conname}: ${c.def}`));

  // 2. Check existing values
  const { rows: kinds } = await client.query(`
    SELECT DISTINCT manual_resolution_kind FROM news_tasks WHERE manual_resolution_kind IS NOT NULL
  `);
  console.log('\n=== EXISTING manual_resolution_kind VALUES ===');
  kinds.forEach(r => console.log(`  ${r.manual_resolution_kind}`));

  // 3. Check consensus_status constraint
  const { rows: statusConstraints } = await client.query(`
    SELECT conname, pg_get_constraintdef(oid) as def
    FROM pg_constraint
    WHERE conrelid = 'public.news_tasks'::regclass
    AND conname ILIKE '%consensus_status%' OR conname ILIKE '%status%'
  `);
  console.log('\n=== STATUS CONSTRAINTS ===');
  statusConstraints.forEach(c => console.log(`  ${c.conname}: ${c.def}`));

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
