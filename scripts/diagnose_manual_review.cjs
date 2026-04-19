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

  // 1. How settle_open_news_tasks decides manual_review
  console.log('=== settle_open_news_tasks SOURCE ===');
  const { rows } = await client.query(`
    SELECT pg_get_functiondef(oid) FROM pg_proc
    WHERE proname = 'settle_open_news_tasks'
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LIMIT 1
  `);
  console.log(rows[0]?.pg_get_functiondef);

  // 2. Manual review stats — votes per task
  console.log('\n=== MANUAL_REVIEW TASK VOTE STATS ===');
  const { rows: stats } = await client.query(`
    SELECT 
      nt.id,
      nt.content->>'title' as title,
      nt.cycle_number,
      COUNT(v.id) as vote_count,
      SUM(CASE WHEN v.verdict THEN 1 ELSE 0 END) as true_votes,
      SUM(CASE WHEN NOT v.verdict THEN 1 ELSE 0 END) as false_votes
    FROM news_tasks nt
    LEFT JOIN validations v ON v.task_id = nt.id
    WHERE nt.consensus_status = 'manual_review'
    GROUP BY nt.id
    ORDER BY vote_count DESC
    LIMIT 20
  `);
  stats.forEach(r => console.log(`  votes=${r.vote_count} (T=${r.true_votes} F=${r.false_votes}) | cycle#${r.cycle_number} | ${r.title?.substring(0,50)}`));

  // 3. Distribution of vote counts
  console.log('\n=== DISTRIBUIÇÃO DE VOTOS NAS MANUAL_REVIEW ===');
  const { rows: dist } = await client.query(`
    SELECT 
      CASE 
        WHEN vote_count = 0 THEN '0 votos'
        WHEN vote_count BETWEEN 1 AND 4 THEN '1-4 votos'
        WHEN vote_count BETWEEN 5 AND 9 THEN '5-9 votos'
        WHEN vote_count >= 10 THEN '10+ votos'
      END as faixa,
      COUNT(*) as tasks
    FROM (
      SELECT nt.id, COUNT(v.id) as vote_count
      FROM news_tasks nt
      LEFT JOIN validations v ON v.task_id = nt.id
      WHERE nt.consensus_status = 'manual_review'
      GROUP BY nt.id
    ) sub
    GROUP BY 1 ORDER BY 1
  `);
  dist.forEach(r => console.log(`  ${r.faixa}: ${r.tasks} tasks`));

  // 4. Check admin_force_settle or admin resolution function
  console.log('\n=== ADMIN RESOLUTION FUNCTIONS ===');
  const { rows: fns } = await client.query(`
    SELECT proname FROM pg_proc
    WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    AND (proname ILIKE '%admin%settle%' OR proname ILIKE '%admin%resolve%' OR proname ILIKE '%admin%force%' OR proname ILIKE '%void%')
    ORDER BY proname
  `);
  fns.forEach(f => console.log(`  ${f.proname}`));

  // 5. Get the void function source
  console.log('\n=== admin_void_news_task SOURCE ===');
  const { rows: voidFn } = await client.query(`
    SELECT pg_get_functiondef(oid) FROM pg_proc
    WHERE proname = 'admin_void_news_task'
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LIMIT 1
  `);
  console.log(voidFn[0]?.pg_get_functiondef || 'NOT FOUND');

  // 6. Get admin_force_settle source
  console.log('\n=== admin_force_settle_news_task SOURCE ===');
  const { rows: forceFn } = await client.query(`
    SELECT pg_get_functiondef(oid) FROM pg_proc
    WHERE proname = 'admin_force_settle_news_task'
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LIMIT 1
  `);
  console.log(forceFn[0]?.pg_get_functiondef || 'NOT FOUND');

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
