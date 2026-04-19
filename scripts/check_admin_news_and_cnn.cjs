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

  // 1. Admin posts still open?
  console.log('=== ADMIN POSTS ABERTOS ===');
  const { rows: admin } = await client.query(`
    SELECT id, content->>'title' as title, cycle_number, consensus_status, created_at
    FROM news_tasks
    WHERE is_admin_post = true AND consensus_status = 'open' AND consensus_reached = false
    ORDER BY created_at DESC LIMIT 20
  `);
  console.log(`Total admin posts abertos: ${admin.length}`);
  admin.slice(0,5).forEach(r => console.log(`  [cycle#${r.cycle_number}] ${r.title?.substring(0,60)}`));

  // 2. Scraped posts open
  console.log('\n=== SCRAPED POSTS ABERTOS ===');
  const { rows: scraped } = await client.query(`
    SELECT id, content->>'title' as title, content->>'source' as source, cycle_number, created_at
    FROM news_tasks
    WHERE is_admin_post = false AND consensus_status = 'open' AND consensus_reached = false
    ORDER BY created_at DESC LIMIT 20
  `);
  console.log(`Total scraped posts abertos: ${scraped.length}`);
  scraped.slice(0,5).forEach(r => console.log(`  [cycle#${r.cycle_number}] ${r.source} | ${r.title?.substring(0,55)}`));

  // 3. Frontend query: what does the user see?
  // The frontend filters: is_admin_post = true, consensus_reached = false, consensus_status = 'open'
  // This means SCRAPED news (is_admin_post=false) are NOT shown!
  console.log('\n=== PROBLEMA: FRONTEND SÓ MOSTRA is_admin_post=true ===');
  console.log('As notícias scraped (is_admin_post=false) NÃO aparecem para os usuários!');

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
