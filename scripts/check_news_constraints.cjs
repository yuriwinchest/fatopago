const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function run() {
    const client = new Client({
        host: 'aws-1-us-east-1.pooler.supabase.com',
        port: 6543,
        user: 'postgres.raxjzfvunjxqbxswuipp',
        password: process.env.SUPABASE_DB_PASSWORD,
        database: 'postgres',
        ssl: { rejectUnauthorized: false },
        statement_timeout: 60000,
    });
    await client.connect();

    // UNIQUE / constraints em news_tasks
    const r1 = await client.query(`
        SELECT conname, contype, pg_get_constraintdef(oid) AS def
        FROM pg_constraint
        WHERE conrelid = 'public.news_tasks'::regclass
        ORDER BY contype, conname
    `);
    console.log('CONSTRAINTS em news_tasks:');
    r1.rows.forEach(r => console.log(`  [${r.contype}] ${r.conname}: ${r.def}`));

    // Indexes
    const r2 = await client.query(`
        SELECT indexname, indexdef FROM pg_indexes
        WHERE schemaname='public' AND tablename='news_tasks'
        ORDER BY indexname
    `);
    console.log('\nINDEXES em news_tasks:');
    r2.rows.forEach(r => console.log(`  ${r.indexname}`));

    // Admin posts por ciclo (não só 12 mais recentes, TODOS)
    const r3 = await client.query(`
        SELECT cycle_number, cycle_start_at, COUNT(*)::int AS n
        FROM public.news_tasks
        WHERE is_admin_post = TRUE
        GROUP BY cycle_number, cycle_start_at
        ORDER BY cycle_start_at DESC
    `);
    console.log('\nADMIN POSTS POR CICLO (todos):');
    r3.rows.forEach(r => console.log(`  cycle#${r.cycle_number} inicio=${r.cycle_start_at?.toISOString?.()} n=${r.n}`));

    // Ciclo atual
    const r4 = await client.query(`SELECT * FROM public.get_weekly_cycle_window(NOW(), 0)`);
    console.log('\nCICLO ATUAL:');
    console.log(`  ${JSON.stringify(r4.rows[0])}`);

    // Logs de erro recentes na tabela (se existir audit)
    const r5 = await client.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name ILIKE '%audit%' OR table_name ILIKE '%log%'
        LIMIT 20
    `);
    console.log('\nTabelas de audit/log existentes:');
    r5.rows.forEach(r => console.log(`  ${r.table_name}`));

    await client.end();
}
run().catch(e => { console.error('Erro:', e.message || e); process.exit(1); });
