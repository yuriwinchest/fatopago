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

  // 1. get_weekly_cycle_window
  console.log('=== get_weekly_cycle_window ===');
  const { rows: r1 } = await client.query(`
    SELECT pg_get_functiondef(oid) FROM pg_proc
    WHERE proname = 'get_weekly_cycle_window' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LIMIT 1
  `);
  console.log(r1[0]?.pg_get_functiondef?.substring(0, 800));

  // 2. get_validation_cycle_meta  
  console.log('\n=== get_validation_cycle_meta ===');
  const { rows: r2 } = await client.query(`
    SELECT pg_get_functiondef(oid) FROM pg_proc
    WHERE proname = 'get_validation_cycle_meta' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LIMIT 1
  `);
  console.log(r2[0]?.pg_get_functiondef || 'NOT FOUND');

  // 3. admin_create_news_task
  console.log('\n=== admin_create_news_task ===');
  const { rows: r3 } = await client.query(`
    SELECT pg_get_functiondef(oid) FROM pg_proc
    WHERE proname = 'admin_create_news_task' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LIMIT 1
  `);
  console.log(r3[0]?.pg_get_functiondef || 'NOT FOUND');

  // 4. Current time and cycle boundaries
  console.log('\n=== TEMPO ATUAL E JANELAS ===');
  const { rows: time } = await client.query(`
    SELECT NOW() as agora,
           NOW() AT TIME ZONE 'America/Sao_Paulo' as agora_brt,
           c.*
    FROM get_weekly_cycle_window(NOW(), 0) c
  `);
  console.log(JSON.stringify(time[0], null, 2));

  // 5. When did last cycle end and this one start?
  console.log('\n=== HORA EXATA DE TRANSIÇÃO (UTC e BRT) ===');
  const { rows: trans } = await client.query(`
    SELECT 
      cycle_end_at as ciclo_anterior_termina,
      cycle_end_at AT TIME ZONE 'America/Sao_Paulo' as ciclo_anterior_termina_brt,
      next_cycle_start_at as proximo_ciclo_comeca,
      next_cycle_start_at AT TIME ZONE 'America/Sao_Paulo' as proximo_ciclo_comeca_brt
    FROM get_weekly_cycle_window(NOW(), 1)
  `);
  console.log(JSON.stringify(trans[0], null, 2));

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
