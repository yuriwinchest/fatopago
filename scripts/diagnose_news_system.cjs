const { Client } = require('pg');
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });

const client = new Client({
  host: 'db.raxjzfvunjxqbxswuipp.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();

  // 1. news_tasks columns
  console.log('=== NEWS_TASKS SCHEMA ===');
  const cols = await client.query(`
    SELECT column_name, data_type, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'news_tasks' AND table_schema = 'public'
    ORDER BY ordinal_position
  `);
  cols.rows.forEach(c => console.log(`  ${c.column_name} (${c.data_type}) default=${c.column_default || 'null'} nullable=${c.is_nullable}`));

  // 2. Distinct statuses
  console.log('\n=== NEWS_TASKS STATUS DISTRIBUTION ===');
  const statuses = await client.query(`SELECT status, COUNT(*) as cnt FROM news_tasks GROUP BY status ORDER BY cnt DESC`);
  statuses.rows.forEach(r => console.log(`  ${r.status}: ${r.cnt}`));

  // 3. All cron jobs
  console.log('\n=== ALL CRON JOBS ===');
  try {
    const crons = await client.query(`SELECT jobid, schedule, command, active FROM cron.job ORDER BY jobid`);
    crons.rows.forEach(j => console.log(`  [${j.active ? 'ON' : 'OFF'}] id=${j.jobid} schedule="${j.schedule}"\n    cmd: ${j.command.substring(0, 200)}`));
  } catch (e) {
    console.log('  Error:', e.message);
  }

  // 4. Tables with "cycle" in name
  console.log('\n=== TABLES WITH "CYCLE" ===');
  const cycleTables = await client.query(`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename ILIKE '%cycle%'
  `);
  cycleTables.rows.forEach(r => console.log(`  ${r.tablename}`));

  // 5. Functions with "cycle" in name
  console.log('\n=== FUNCTIONS WITH "CYCLE" ===');
  const cycleFns = await client.query(`
    SELECT proname FROM pg_proc
    WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    AND proname ILIKE '%cycle%'
  `);
  cycleFns.rows.forEach(f => console.log(`  ${f.proname}`));

  // 6. Currently open tasks
  console.log('\n=== OPEN NEWS TASKS ===');
  const open = await client.query(`
    SELECT id, title, status, created_at, expires_at
    FROM news_tasks WHERE status = 'open'
    ORDER BY created_at DESC LIMIT 5
  `);
  if (open.rows.length === 0) console.log('  NENHUMA!');
  open.rows.forEach(t => console.log(`  ${t.title?.substring(0,60)} | expires=${t.expires_at} | created=${t.created_at}`));

  // 7. Most recent tasks of any status
  console.log('\n=== ÚLTIMAS 10 NEWS TASKS (qualquer status) ===');
  const recent = await client.query(`
    SELECT id, title, status, created_at, expires_at, settled_at
    FROM news_tasks
    ORDER BY created_at DESC LIMIT 10
  `);
  recent.rows.forEach(t => console.log(`  [${t.status}] ${t.title?.substring(0,50)} | created=${t.created_at} | expires=${t.expires_at} | settled=${t.settled_at || '-'}`));

  // 8. Check if there's an expires_at in the past for open tasks
  console.log('\n=== TASKS WITH EXPIRED expires_at BUT STILL OPEN ===');
  const expired = await client.query(`
    SELECT COUNT(*) as cnt FROM news_tasks WHERE status = 'open' AND expires_at < NOW()
  `);
  console.log(`  ${expired.rows[0].cnt} tasks`);

  // 9. Functions with "settle" in name
  console.log('\n=== SETTLE FUNCTIONS ===');
  const settleFns = await client.query(`
    SELECT proname FROM pg_proc
    WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    AND proname ILIKE '%settle%'
  `);
  settleFns.rows.forEach(f => console.log(`  ${f.proname}`));

  // 10. Check news_tasks cycle_id column
  console.log('\n=== CYCLE_ID ON NEWS_TASKS ===');
  const cycleCol = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'news_tasks' AND column_name ILIKE '%cycle%'
  `);
  if (cycleCol.rows.length === 0) console.log('  NÃO TEM cycle_id');
  cycleCol.rows.forEach(c => console.log(`  ${c.column_name}`));

  // 11. validation_cycles or similar
  console.log('\n=== VALIDATION_CYCLES TABLE ===');
  const vc = await client.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'validation_cycles' AND table_schema = 'public'
    ORDER BY ordinal_position
  `);
  if (vc.rows.length === 0) console.log('  NÃO EXISTE');
  vc.rows.forEach(c => console.log(`  ${c.column_name} (${c.data_type})`));

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
