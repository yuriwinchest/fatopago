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
        connectionTimeoutMillis: 15000,
        statement_timeout: 60000,
    });

    await client.connect();

    // 1) Timeline admin: quando foram cadastradas?
    const r1 = await client.query(`
        SELECT DATE(created_at AT TIME ZONE 'America/Sao_Paulo') AS dia,
               COUNT(*)::int AS n
        FROM public.news_tasks
        WHERE is_admin_post = TRUE
        GROUP BY 1
        ORDER BY 1 DESC
        LIMIT 30
    `);
    console.log('ADMIN POSTS CADASTRADOS POR DIA (America/Sao_Paulo):');
    r1.rows.forEach(r => console.log(`  ${r.dia.toISOString().split('T')[0]}  n=${r.n}`));

    // 2) O que admin_list_news_by_cycle retorna?
    const r2 = await client.query(`SELECT COUNT(*)::int AS n FROM public.admin_list_news_by_cycle(0)`);
    console.log(`\nadmin_list_news_by_cycle(0) retorna: ${r2.rows[0].n} linhas`);

    // 3) As 20 mais recentes que o painel deveria listar.
    const r3 = await client.query(`
        SELECT id, cycle_number, created_at, title FROM public.admin_list_news_by_cycle(0) ORDER BY created_at DESC LIMIT 20
    `);
    console.log('\nTOP 20 retornadas pelo painel (admin_list_news_by_cycle):');
    r3.rows.forEach(r => console.log(`  cycle#${r.cycle_number} ${r.created_at?.toISOString?.() || r.created_at} | ${String(r.title || '').slice(0, 70)}`));

    // 4) Existe alguma outra funcao / view que conte noticias admin e inclua scraped por bug?
    const r4 = await client.query(`
        SELECT routine_name
        FROM information_schema.routines
        WHERE routine_schema = 'public' AND routine_name ILIKE '%news%'
        ORDER BY routine_name
    `);
    console.log('\nFunções relacionadas a news:');
    r4.rows.forEach(r => console.log(`  ${r.routine_name}`));

    // 5) Total de validacoes por usuario (top 10) — pra ver se o count inclui scraped.
    const r5 = await client.query(`
        SELECT v.user_id,
               COUNT(*)::int AS total_validacoes,
               COUNT(*) FILTER (WHERE nt.is_admin_post = TRUE)::int AS em_admin,
               COUNT(*) FILTER (WHERE COALESCE(nt.is_admin_post, FALSE) = FALSE)::int AS em_scraped
        FROM public.validations v
        JOIN public.news_tasks nt ON nt.id = v.task_id
        GROUP BY v.user_id
        ORDER BY total_validacoes DESC
        LIMIT 10
    `);
    console.log('\nTOP 10 validadores (historico):');
    console.log('  user_id                              | total | admin | scraped');
    r5.rows.forEach(r => console.log(`  ${r.user_id} | ${String(r.total_validacoes).padStart(5)} | ${String(r.em_admin).padStart(5)} | ${String(r.em_scraped).padStart(7)}`));

    await client.end();
}

run().catch(e => { console.error('Erro:', e.message || e); process.exit(1); });
