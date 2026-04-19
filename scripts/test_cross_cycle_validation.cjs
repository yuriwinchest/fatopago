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

  // The submit_validation dedup check uses:
  //   WHERE user_id = v_user_id AND task_id = p_task_id AND created_at >= v_current_cycle_start
  //
  // This means: "did this user already validate THIS task in THE CURRENT cycle?"
  // It does NOT check the task's cycle_number. So a user CAN validate a cycle#5 task
  // during cycle#6, as long as they haven't already validated it in cycle#6.
  //
  // But wait — there's also a UNIQUE index on (user_id, task_id):
  console.log('=== UNIQUE CONSTRAINTS ON VALIDATIONS ===');
  const { rows: idx } = await client.query(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'validations'
    AND indexdef ILIKE '%unique%'
  `);
  idx.forEach(i => console.log(`  ${i.indexname}: ${i.indexdef}`));

  // Check if it's unique per (user_id, task_id) UNCONDITIONALLY or per cycle
  console.log('\n=== ALL INDEXES ON VALIDATIONS ===');
  const { rows: allIdx } = await client.query(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'validations'
  `);
  allIdx.forEach(i => console.log(`  ${i.indexname}: ${i.indexdef}`));

  // Check the actual submit_validation dedup logic again
  console.log('\n=== DEDUP CHECK IN SUBMIT_VALIDATION ===');
  const { rows: fnSrc } = await client.query(`
    SELECT prosrc FROM pg_proc
    WHERE proname = 'submit_validation'
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ORDER BY pronargs DESC LIMIT 1
  `);
  const src = fnSrc[0]?.prosrc || '';
  const dedupLines = src.split('\n').filter(l => /EXISTS|user_id.*task_id|already|validou|cycle_start/i.test(l));
  dedupLines.forEach(l => console.log(`  ${l.trim()}`));

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
