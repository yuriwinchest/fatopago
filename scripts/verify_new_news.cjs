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

  // Check latest news tasks
  console.log('=== ÚLTIMAS 20 NEWS TASKS ===');
  const { rows } = await client.query(`
    SELECT id, content->>'title' as title, content->>'source' as source,
           cycle_number, cycle_start_at, is_admin_post, consensus_status,
           created_at
    FROM news_tasks
    ORDER BY created_at DESC
    LIMIT 20
  `);
  rows.forEach(r => console.log(`  [cycle#${r.cycle_number}] admin=${r.is_admin_post} | ${r.source} | ${r.consensus_status} | ${r.title?.substring(0,55)} | ${new Date(r.created_at).toISOString()}`));

  // Status summary
  console.log('\n=== STATUS GERAL ===');
  const { rows: stats } = await client.query(`
    SELECT consensus_status, COUNT(*) as cnt FROM news_tasks GROUP BY consensus_status ORDER BY cnt DESC
  `);
  stats.forEach(r => console.log(`  ${r.consensus_status}: ${r.cnt}`));

  // Total open available
  console.log('\n=== TOTAL OPEN (visível para usuários) ===');
  const { rows: open } = await client.query(`
    SELECT COUNT(*) as cnt FROM news_tasks
    WHERE consensus_reached = false AND consensus_status = 'open'
  `);
  console.log(`  ${open[0].cnt} notícias abertas`);

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
