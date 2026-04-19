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

  // 1. Current and recent cycles
  console.log('=== ÚLTIMOS 5 CICLOS ===');
  const cycles = await client.query(`
    SELECT id, cycle_number, status, starts_at, ends_at, created_at
    FROM news_cycles
    ORDER BY cycle_number DESC
    LIMIT 5
  `);
  cycles.rows.forEach(c => console.log(`  #${c.cycle_number} | status=${c.status} | starts=${c.starts_at} | ends=${c.ends_at}`));

  // 2. Cron jobs related to cycles/news
  console.log('\n=== CRON JOBS (pg_cron) ===');
  const crons = await client.query(`SELECT jobid, schedule, command, nodename, active FROM cron.job ORDER BY jobid`);
  crons.rows.forEach(j => console.log(`  [${j.active ? 'ON' : 'OFF'}] id=${j.jobid} schedule="${j.schedule}" cmd=${j.command.substring(0, 120)}...`));

  // 3. News tasks — recent counts by status
  console.log('\n=== NEWS TASKS POR STATUS (últimos 3 dias) ===');
  const taskStats = await client.query(`
    SELECT status, COUNT(*) as cnt
    FROM news_tasks
    WHERE created_at >= NOW() - INTERVAL '3 days'
    GROUP BY status
    ORDER BY cnt DESC
  `);
  taskStats.rows.forEach(r => console.log(`  ${r.status}: ${r.cnt}`));

  // 4. News tasks available right now (open, not settled)
  console.log('\n=== NEWS TASKS DISPONÍVEIS AGORA (status=open) ===');
  const openTasks = await client.query(`
    SELECT id, title, status, cycle_id, created_at, expires_at
    FROM news_tasks
    WHERE status = 'open'
    ORDER BY created_at DESC
    LIMIT 10
  `);
  if (openTasks.rows.length === 0) {
    console.log('  NENHUMA NOTÍCIA ABERTA!');
  } else {
    openTasks.rows.forEach(t => console.log(`  ${t.id} | ${t.title?.substring(0,50)} | cycle=${t.cycle_id} | expires=${t.expires_at}`));
  }

  // 5. Total news tasks per cycle (last 3)
  console.log('\n=== TOTAL NEWS TASKS POR CICLO (últimos 3) ===');
  const cycleIds = cycles.rows.slice(0, 3).map(c => c.id);
  for (const cid of cycleIds) {
    const { rows } = await client.query(`
      SELECT status, COUNT(*) as cnt FROM news_tasks WHERE cycle_id = $1 GROUP BY status ORDER BY status
    `, [cid]);
    const cycleInfo = cycles.rows.find(c => c.id === cid);
    console.log(`  Ciclo #${cycleInfo.cycle_number} (${cid}):`);
    rows.forEach(r => console.log(`    ${r.status}: ${r.cnt}`));
  }

  // 6. Check if there's a function that starts/rotates cycles
  console.log('\n=== FUNÇÕES DE CICLO ===');
  const fns = await client.query(`
    SELECT proname FROM pg_proc
    WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    AND proname ILIKE '%cycle%'
    ORDER BY proname
  `);
  fns.rows.forEach(f => console.log(`  ${f.proname}`));

  // 7. Check settle functions
  console.log('\n=== FUNÇÕES DE SETTLE ===');
  const settleFns = await client.query(`
    SELECT proname FROM pg_proc
    WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    AND proname ILIKE '%settle%'
    ORDER BY proname
  `);
  settleFns.rows.forEach(f => console.log(`  ${f.proname}`));

  // 8. Check news_tasks table structure — what determines if a task is available
  console.log('\n=== NEWS_TASKS COLUMNS ===');
  const cols = await client.query(`
    SELECT column_name, data_type, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'news_tasks' AND table_schema = 'public'
    ORDER BY ordinal_position
  `);
  cols.rows.forEach(c => console.log(`  ${c.column_name} (${c.data_type}) default=${c.column_default || 'null'} nullable=${c.is_nullable}`));

  // 9. Check what happened to tasks at end of last cycle — were they settled?
  const lastEndedCycle = cycles.rows.find(c => c.status === 'ended' || c.status === 'settled');
  if (lastEndedCycle) {
    console.log(`\n=== ÚLTIMO CICLO ENCERRADO: #${lastEndedCycle.cycle_number} ===`);
    const { rows: settled } = await client.query(`
      SELECT status, COUNT(*) as cnt FROM news_tasks WHERE cycle_id = $1 GROUP BY status
    `, [lastEndedCycle.id]);
    settled.forEach(r => console.log(`  ${r.status}: ${r.cnt}`));
  }

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
