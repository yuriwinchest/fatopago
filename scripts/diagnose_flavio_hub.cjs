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

    // 1) Encontra o Flavio
    const u = await client.query(`
        SELECT id, name, lastname
        FROM public.profiles
        WHERE lower(name) LIKE '%flavio%' AND lower(lastname) LIKE '%eduardo%'
        LIMIT 5
    `);
    console.log('USUARIOS ENCONTRADOS:');
    u.rows.forEach(r => console.log(`  ${r.id} -> ${r.name} ${r.lastname}`));
    if (u.rows.length === 0) { await client.end(); return; }
    const user = u.rows[0];
    console.log(`\nUsando: ${user.name} ${user.lastname} (${user.id})\n`);

    // 2) Plano ativo do Flavio
    const pp = await client.query(`
        SELECT id, status, started_at, completed_at, used_validations,
               validation_credit_remaining, last_validation_at
        FROM public.plan_purchases
        WHERE user_id = $1
        ORDER BY started_at DESC
        LIMIT 5
    `, [user.id]);
    console.log('PLAN_PURCHASES (ultimos 5):');
    pp.rows.forEach(r => console.log(`  id=${r.id} status=${r.status} used=${r.used_validations} credit_remaining=${r.validation_credit_remaining} started=${r.started_at?.toISOString?.()} completed=${r.completed_at?.toISOString?.()}`));

    const activePlan = pp.rows.find(r => r.status === 'active') || null;
    console.log(`\nPlano ATIVO: ${activePlan ? activePlan.id : 'NENHUM'}`);

    // 3) Pool TOTAL de admin posts abertas no ciclo atual
    const pool = await client.query(`
        WITH cyc AS (SELECT * FROM public.get_weekly_cycle_window(NOW(), 0))
        SELECT
          COUNT(*)::int AS total_admin,
          COUNT(*) FILTER (WHERE COALESCE(consensus_reached, FALSE) = FALSE AND COALESCE(consensus_status, 'open') = 'open')::int AS abertas,
          COUNT(*) FILTER (WHERE COALESCE(consensus_reached, FALSE) = TRUE)::int AS consensus_reached,
          COUNT(*) FILTER (WHERE COALESCE(consensus_status, 'open') <> 'open')::int AS status_nao_open
        FROM public.news_tasks nt
        CROSS JOIN cyc c
        WHERE nt.is_admin_post = TRUE
          AND nt.cycle_start_at = c.cycle_start_at
    `);
    console.log('\nPOOL ADMIN CICLO ATUAL:', JSON.stringify(pool.rows[0]));

    // 4) Admin posts de TODOS os ciclos (inclui anteriores — hub nao filtra por ciclo na query)
    const poolAll = await client.query(`
        SELECT
          COUNT(*)::int AS total_admin,
          COUNT(*) FILTER (WHERE COALESCE(consensus_reached, FALSE) = FALSE AND COALESCE(consensus_status, 'open') = 'open')::int AS abertas
        FROM public.news_tasks nt
        WHERE nt.is_admin_post = TRUE
    `);
    console.log('POOL ADMIN TOTAL (todos ciclos):', JSON.stringify(poolAll.rows[0]));

    // 5) Quantas o Flavio ja validou no plano ativo (esse eh o criterio do hub)
    if (activePlan) {
        const v1 = await client.query(`
            SELECT COUNT(*)::int AS n FROM public.validations
            WHERE user_id = $1 AND plan_purchase_id = $2
        `, [user.id, activePlan.id]);
        console.log(`\nVALIDACOES do Flavio NO PLANO ATIVO: ${v1.rows[0].n}`);
    }

    // 6) Quantas admin-posts abertas (todos ciclos) ele AINDA NAO validou neste plano
    if (activePlan) {
        const r = await client.query(`
            SELECT COUNT(*)::int AS n
            FROM public.news_tasks nt
            WHERE nt.is_admin_post = TRUE
              AND COALESCE(nt.consensus_reached, FALSE) = FALSE
              AND COALESCE(nt.consensus_status, 'open') = 'open'
              AND nt.id NOT IN (
                SELECT task_id FROM public.validations
                WHERE user_id = $1 AND plan_purchase_id = $2
              )
        `, [user.id, activePlan.id]);
        console.log(`DISPONIVEIS pra ele validar AGORA (admin, abertas, nao-validadas neste plano): ${r.rows[0].n}`);
    } else {
        // sem plano ativo: fallback por ciclo atual
        const r = await client.query(`
            WITH cyc AS (SELECT * FROM public.get_weekly_cycle_window(NOW(), 0))
            SELECT COUNT(*)::int AS n
            FROM public.news_tasks nt
            CROSS JOIN cyc c
            WHERE nt.is_admin_post = TRUE
              AND COALESCE(nt.consensus_reached, FALSE) = FALSE
              AND COALESCE(nt.consensus_status, 'open') = 'open'
              AND nt.id NOT IN (
                SELECT task_id FROM public.validations
                WHERE user_id = $1 AND created_at >= c.cycle_start_at
              )
        `, [user.id]);
        console.log(`DISPONIVEIS (sem plano, fallback por ciclo atual): ${r.rows[0].n}`);
    }

    // 7) Validacoes totais do Flavio no ciclo atual (toda a serie)
    const vAll = await client.query(`
        WITH cyc AS (SELECT * FROM public.get_weekly_cycle_window(NOW(), 0))
        SELECT
          COUNT(*) FILTER (WHERE COALESCE(nt.is_admin_post, FALSE) = TRUE)::int AS admin,
          COUNT(*) FILTER (WHERE COALESCE(nt.is_admin_post, FALSE) = FALSE)::int AS scraped,
          COUNT(*)::int AS total
        FROM public.validations v
        LEFT JOIN public.news_tasks nt ON nt.id = v.task_id
        CROSS JOIN cyc c
        WHERE v.user_id = $1
          AND v.created_at >= c.cycle_start_at AND v.created_at < c.cycle_end_at
    `, [user.id]);
    console.log('\nVALIDACOES Flavio CICLO ATUAL:', JSON.stringify(vAll.rows[0]));

    await client.end();
}
run().catch(e => { console.error('Erro:', e.message || e); process.exit(1); });
