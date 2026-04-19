const { Client } = require('pg');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const client = new Client({
  host: 'db.raxjzfvunjxqbxswuipp.supabase.co',
  port: 5432, database: 'postgres', user: 'postgres',
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();

  // 1. Última notícia inserida (para saber se worker está rodando)
  console.log('=== ÚLTIMAS 10 NOTÍCIAS CRIADAS ===');
  const latest = await client.query(`
    SELECT id, content->>'title' as title, content->>'source' as source,
           is_admin_post, consensus_status, consensus_reached, created_at
    FROM news_tasks ORDER BY created_at DESC LIMIT 10
  `);
  latest.rows.forEach(t => console.log(
    `  [admin=${t.is_admin_post}] [${t.consensus_status}/${t.consensus_reached}] ${t.source} | ${t.title?.substring(0,50)} | ${t.created_at}`
  ));

  // 2. Distribuição por source nas últimas 24h
  console.log('\n=== NOTÍCIAS CRIADAS NAS ÚLTIMAS 24H POR SOURCE ===');
  const by24h = await client.query(`
    SELECT content->>'source' as source, COUNT(*) as cnt
    FROM news_tasks
    WHERE created_at >= NOW() - INTERVAL '24 hours'
    GROUP BY content->>'source'
    ORDER BY cnt DESC
  `);
  if (by24h.rows.length === 0) console.log('  NENHUMA notícia criada nas últimas 24h (worker parado!)');
  else by24h.rows.forEach(r => console.log(`  ${r.source}: ${r.cnt}`));

  // 3. Notícias abertas por source
  console.log('\n=== NOTÍCIAS ABERTAS (visíveis para usuários) POR SOURCE ===');
  const openBySource = await client.query(`
    SELECT content->>'source' as source, COUNT(*) as cnt, BOOL_OR(is_admin_post) as has_admin
    FROM news_tasks
    WHERE consensus_reached = false AND consensus_status = 'open'
    GROUP BY content->>'source'
    ORDER BY cnt DESC
  `);
  openBySource.rows.forEach(r => console.log(`  [admin=${r.has_admin}] ${r.source}: ${r.cnt}`));
  const totalOpen = openBySource.rows.reduce((s,r)=>s+Number(r.cnt),0);
  console.log(`  TOTAL ABERTAS: ${totalOpen}`);

  // 4. Distribuição por consensus_status
  console.log('\n=== DISTRIBUIÇÃO POR consensus_status ===');
  const byStatus = await client.query(`
    SELECT consensus_status, consensus_reached, COUNT(*) as cnt
    FROM news_tasks GROUP BY consensus_status, consensus_reached ORDER BY cnt DESC
  `);
  byStatus.rows.forEach(r => console.log(`  ${r.consensus_status} (reached=${r.consensus_reached}): ${r.cnt}`));

  // 5. Ciclo atual
  console.log('\n=== CICLO ATUAL ===');
  const cycle = await client.query(`SELECT * FROM get_weekly_cycle_window(NOW(), 0)`);
  console.log(JSON.stringify(cycle.rows[0], null, 2));

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
