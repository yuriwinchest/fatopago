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

  // 1. What tasks are currently VISIBLE to users?
  // Frontend query: is_admin_post=true, consensus_reached=false, consensus_status='open'
  console.log('=== VISÍVEIS PARA USUÁRIOS AGORA ===');
  const visible = await client.query(`
    SELECT id, content->>'title' as title, cycle_number, cycle_start_at, consensus_status, consensus_reached, created_at
    FROM news_tasks
    WHERE is_admin_post = true AND consensus_reached = false AND consensus_status = 'open'
    ORDER BY admin_priority ASC NULLS LAST, created_at DESC
  `);
  console.log(`Total: ${visible.rows.length}`);
  visible.rows.forEach(t => console.log(`  [cycle#${t.cycle_number}] ${t.title?.substring(0,60)} | created=${new Date(t.created_at).toISOString()}`));

  // 2. What happens with settlement? Are open tasks being settled too aggressively?
  console.log('\n=== SETTLEMENT CRON: run_open_news_task_settlement_job ===');
  const { rows: settleFn } = await client.query(`
    SELECT pg_get_functiondef(oid) FROM pg_proc
    WHERE proname = 'run_open_news_task_settlement_job' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LIMIT 1
  `);
  console.log(settleFn[0]?.pg_get_functiondef || 'NOT FOUND');

  // 3. How many tasks were settled in last 24h?
  console.log('\n=== TASKS SETTLED NAS ÚLTIMAS 24H ===');
  const settled24 = await client.query(`
    SELECT id, content->>'title' as title, consensus_status, settled_at,
           settlement_total_votes, correct_verdict
    FROM news_tasks
    WHERE settled_at >= NOW() - INTERVAL '24 hours'
    ORDER BY settled_at DESC LIMIT 10
  `);
  console.log(`Total: ${settled24.rows.length}`);
  settled24.rows.forEach(t => console.log(`  [${t.consensus_status}] votes=${t.settlement_total_votes} verdict=${t.correct_verdict} | ${t.title?.substring(0,50)} | settled=${t.settled_at}`));

  // 4. How many moved to manual_review in last 24h?
  console.log('\n=== TASKS MOVIDAS PARA MANUAL_REVIEW NAS ÚLTIMAS 24H ===');
  const review24 = await client.query(`
    SELECT id, content->>'title' as title, consensus_closed_at
    FROM news_tasks
    WHERE consensus_status = 'manual_review'
    AND consensus_closed_at >= NOW() - INTERVAL '24 hours'
    ORDER BY consensus_closed_at DESC LIMIT 10
  `);
  console.log(`Total: ${review24.rows.length}`);

  // 5. Overall: how many tasks are open vs settled vs manual_review per cycle
  console.log('\n=== DISTRIBUIÇÃO POR CICLO ===');
  const distrib = await client.query(`
    SELECT cycle_number, consensus_status, COUNT(*) as cnt
    FROM news_tasks
    WHERE cycle_number >= 4
    GROUP BY cycle_number, consensus_status
    ORDER BY cycle_number DESC, consensus_status
  `);
  distrib.rows.forEach(r => console.log(`  cycle#${r.cycle_number} ${r.consensus_status}: ${r.cnt}`));

  // 6. What's the latest news_task created? When was the last one added?
  console.log('\n=== ÚLTIMO NEWS_TASK CRIADO ===');
  const latest = await client.query(`
    SELECT id, content->>'title' as title, created_at, cycle_number, is_admin_post
    FROM news_tasks ORDER BY created_at DESC LIMIT 3
  `);
  latest.rows.forEach(t => console.log(`  [cycle#${t.cycle_number}] admin=${t.is_admin_post} | ${t.title?.substring(0,60)} | ${t.created_at}`));

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
