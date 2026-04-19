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

    // Ciclo atual
    const cyc = await client.query(`SELECT * FROM public.get_weekly_cycle_window(NOW(), 0)`);
    const cycle = cyc.rows[0];
    console.log('CICLO ATUAL:', JSON.stringify(cycle));

    // Distribuicao validacoes ciclo atual: admin vs scraped
    const r0 = await client.query(`
        WITH cyc AS (SELECT * FROM public.get_weekly_cycle_window(NOW(), 0))
        SELECT
          COALESCE(nt.is_admin_post, FALSE) AS is_admin_post,
          COUNT(*)::int AS n
        FROM public.validations v
        LEFT JOIN public.news_tasks nt ON nt.id = v.task_id
        CROSS JOIN cyc c
        WHERE v.created_at >= c.cycle_start_at AND v.created_at < c.cycle_end_at
        GROUP BY COALESCE(nt.is_admin_post, FALSE)
    `);
    console.log('\nVALIDACOES CICLO ATUAL (public.validations): admin vs scraped:');
    r0.rows.forEach(r => console.log(`  is_admin_post=${r.is_admin_post} => ${r.n}`));

    // Comparacao por usuario: cycle_stats (oficial ranking) vs rollup por fonte (admin/scraped)
    const r1 = await client.query(`
        WITH cyc AS (SELECT * FROM public.get_weekly_cycle_window(NOW(), 0)),
        stats AS (
          SELECT s.user_id, s.validations_count
          FROM public.user_validation_cycle_stats s, cyc c
          WHERE s.cycle_start_at = c.cycle_start_at
        ),
        live AS (
          SELECT
            v.user_id,
            SUM(CASE WHEN COALESCE(nt.is_admin_post, FALSE) THEN 1 ELSE 0 END)::int AS admin_n,
            SUM(CASE WHEN NOT COALESCE(nt.is_admin_post, FALSE) THEN 1 ELSE 0 END)::int AS scraped_n,
            COUNT(*)::int AS total_n
          FROM public.validations v
          LEFT JOIN public.news_tasks nt ON nt.id = v.task_id
          CROSS JOIN cyc c
          WHERE v.created_at >= c.cycle_start_at AND v.created_at < c.cycle_end_at
          GROUP BY v.user_id
        )
        SELECT
          p.name, p.lastname,
          COALESCE(stats.validations_count, 0) AS rank_count,
          COALESCE(live.admin_n, 0) AS admin_n,
          COALESCE(live.scraped_n, 0) AS scraped_n,
          COALESCE(live.total_n, 0) AS live_total
        FROM public.profiles p
        LEFT JOIN stats ON stats.user_id = p.id
        LEFT JOIN live ON live.user_id = p.id
        WHERE COALESCE(stats.validations_count, 0) > 0 OR COALESCE(live.total_n, 0) > 0
        ORDER BY COALESCE(stats.validations_count, 0) DESC
        LIMIT 30
    `);
    console.log('\nPOR USUARIO (ciclo atual):');
    console.log('  name                          rank  admin_nt  scraped_nt  live_total  (diff: rank-live)');
    r1.rows.forEach(r => {
        const name = `${r.name || ''} ${r.lastname || ''}`.padEnd(32).slice(0, 32);
        const diff = Number(r.rank_count) - Number(r.live_total);
        console.log(`  ${name} ${String(r.rank_count).padStart(4)}  ${String(r.admin_n).padStart(7)}  ${String(r.scraped_n).padStart(9)}  ${String(r.live_total).padStart(9)}   ${diff >= 0 ? '+' : ''}${diff}`);
    });

    // Tasks scraped referenciadas por validations ainda existem?
    const r2 = await client.query(`
        WITH cyc AS (SELECT * FROM public.get_weekly_cycle_window(NOW(), 0))
        SELECT
          COUNT(*) FILTER (WHERE nt.id IS NULL) AS orfas,
          COUNT(*) FILTER (WHERE nt.id IS NOT NULL AND NOT COALESCE(nt.is_admin_post, FALSE)) AS scraped_com_task,
          COUNT(*) FILTER (WHERE nt.id IS NOT NULL AND COALESCE(nt.is_admin_post, FALSE)) AS admin_com_task
        FROM public.validations v
        LEFT JOIN public.news_tasks nt ON nt.id = v.task_id
        CROSS JOIN cyc c
        WHERE v.created_at >= c.cycle_start_at
    `);
    console.log('\nVALIDACOES COM TASK EXISTENTE (ciclo atual):', JSON.stringify(r2.rows[0]));

    await client.end();
}
run().catch(e => { console.error('Erro:', e.message || e); process.exit(1); });
