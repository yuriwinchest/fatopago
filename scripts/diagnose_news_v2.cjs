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

  // 1. Task distribution by consensus_status
  console.log('=== NEWS_TASKS POR consensus_status ===');
  const st = await client.query(`SELECT consensus_status, COUNT(*) FROM news_tasks GROUP BY consensus_status ORDER BY count DESC`);
  st.rows.forEach(r => console.log(`  ${r.consensus_status}: ${r.count}`));

  // 2. Current cycle info
  console.log('\n=== CICLO ATUAL ===');
  const cycle = await client.query(`SELECT * FROM get_weekly_cycle_window(NOW(), 0)`);
  console.log(JSON.stringify(cycle.rows[0], null, 2));

  // 3. Previous cycle
  console.log('\n=== CICLO ANTERIOR ===');
  const prevCycle = await client.query(`SELECT * FROM get_weekly_cycle_window(NOW(), 1)`);
  console.log(JSON.stringify(prevCycle.rows[0], null, 2));

  // 4. Open tasks available right now
  console.log('\n=== TASKS ABERTAS AGORA ===');
  const open = await client.query(`
    SELECT id, content->>'title' as title, consensus_status, consensus_reached,
           is_admin_post, cycle_start_at, cycle_number, created_at
    FROM news_tasks
    WHERE consensus_status = 'open' AND consensus_reached = false
    ORDER BY created_at DESC LIMIT 15
  `);
  console.log(`Total abertas: ${open.rows.length}`);
  open.rows.forEach(t => console.log(`  [cycle#${t.cycle_number}] admin=${t.is_admin_post} | ${t.title?.substring(0,60)} | created=${t.created_at}`));

  // 5. Tasks from current cycle
  const currCycleStart = cycle.rows[0]?.cycle_start_at;
  const currCycleEnd = cycle.rows[0]?.cycle_end_at;
  console.log(`\n=== TASKS DO CICLO ATUAL (${currCycleStart} -> ${currCycleEnd}) ===`);
  const currTasks = await client.query(`
    SELECT consensus_status, consensus_reached, COUNT(*) as cnt
    FROM news_tasks
    WHERE cycle_start_at >= $1 AND cycle_start_at < $2
    GROUP BY consensus_status, consensus_reached
  `, [currCycleStart, currCycleEnd]);
  currTasks.rows.forEach(r => console.log(`  ${r.consensus_status} (reached=${r.consensus_reached}): ${r.cnt}`));

  // 6. Tasks from previous cycle
  const prevCycleStart = prevCycle.rows[0]?.cycle_start_at;
  const prevCycleEnd = prevCycle.rows[0]?.cycle_end_at;
  console.log(`\n=== TASKS DO CICLO ANTERIOR (${prevCycleStart} -> ${prevCycleEnd}) ===`);
  const prevTasks = await client.query(`
    SELECT consensus_status, consensus_reached, COUNT(*) as cnt
    FROM news_tasks
    WHERE cycle_start_at >= $1 AND cycle_start_at < $2
    GROUP BY consensus_status, consensus_reached
  `, [prevCycleStart, prevCycleEnd]);
  prevTasks.rows.forEach(r => console.log(`  ${r.consensus_status} (reached=${r.consensus_reached}): ${r.cnt}`));

  // 7. How does useValidationHub filter tasks? Let's check what users actually see
  console.log('\n=== O QUE O FRONTEND MOSTRA (is_admin_post=true, open, not reached) ===');
  const frontendView = await client.query(`
    SELECT id, content->>'title' as title, cycle_number, cycle_start_at, created_at
    FROM news_tasks
    WHERE is_admin_post = true AND consensus_reached = false AND consensus_status = 'open'
    ORDER BY admin_priority ASC NULLS LAST, cycle_start_at DESC, created_at DESC
    LIMIT 10
  `);
  console.log(`Total visíveis: ${frontendView.rows.length}`);
  frontendView.rows.forEach(t => console.log(`  [cycle#${t.cycle_number}] ${t.title?.substring(0,60)} | created=${t.created_at}`));

  // 8. Are there tasks from prev cycle that are still open?
  console.log('\n=== TASKS DO CICLO ANTERIOR AINDA ABERTAS ===');
  const prevOpen = await client.query(`
    SELECT id, content->>'title' as title, cycle_number, consensus_status, consensus_reached
    FROM news_tasks
    WHERE cycle_start_at >= $1 AND cycle_start_at < $2
    AND consensus_status = 'open' AND consensus_reached = false
    ORDER BY created_at DESC LIMIT 10
  `, [prevCycleStart, prevCycleEnd]);
  console.log(`Total: ${prevOpen.rows.length}`);
  prevOpen.rows.forEach(t => console.log(`  [cycle#${t.cycle_number}] ${t.title?.substring(0,60)}`));

  // 9. All cron jobs
  console.log('\n=== CRON JOBS ===');
  const crons = await client.query(`SELECT jobid, schedule, command, active FROM cron.job ORDER BY jobid`);
  crons.rows.forEach(j => {
    const cmd = j.command.length > 150 ? j.command.substring(0, 150) + '...' : j.command;
    console.log(`  [${j.active ? 'ON' : 'OFF'}] id=${j.jobid} schedule="${j.schedule}"\n    ${cmd}`);
  });

  // 10. Check submit_validation — does it restrict by cycle?
  console.log('\n=== SUBMIT_VALIDATION CYCLE CHECK ===');
  const svSrc = await client.query(`
    SELECT prosrc FROM pg_proc
    WHERE proname = 'submit_validation'
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ORDER BY pronargs DESC LIMIT 1
  `);
  const src = svSrc.rows[0]?.prosrc || '';
  // Extract cycle-related logic
  const cycleLines = src.split('\n').filter(l => /cycle|7\s*day|604800|expires/i.test(l));
  console.log('  Cycle-related lines in submit_validation:');
  cycleLines.forEach(l => console.log(`    ${l.trim()}`));

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
