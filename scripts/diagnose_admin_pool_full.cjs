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
    console.log('Conectado.\n');

    // 1) Total absoluto de admin posts.
    const r1 = await client.query(`SELECT COUNT(*)::int AS total FROM public.news_tasks WHERE is_admin_post = TRUE`);
    console.log(`TOTAL ADMIN POSTS (is_admin_post = TRUE, todos os estados): ${r1.rows[0].total}`);

    // 2) Breakdown por consensus_reached x consensus_status.
    const r2 = await client.query(`
        SELECT
            COALESCE(consensus_reached, FALSE) AS reached,
            COALESCE(consensus_status, 'null') AS status,
            COUNT(*)::int AS n
        FROM public.news_tasks
        WHERE is_admin_post = TRUE
        GROUP BY 1, 2
        ORDER BY 1, 2
    `);
    console.log('\nBreakdown admin posts (reached x status):');
    r2.rows.forEach(r => console.log(`  reached=${String(r.reached).padEnd(5)} status=${String(r.status).padEnd(12)} n=${r.n}`));

    // 3) Admin visíveis no hub (filtro atual do frontend).
    const r3 = await client.query(`
        SELECT COUNT(*)::int AS total
        FROM public.news_tasks
        WHERE is_admin_post = TRUE
          AND consensus_reached = FALSE
          AND consensus_status = 'open'
    `);
    console.log(`\nADMIN VISIVEIS NO HUB (reached=false AND status=open): ${r3.rows[0].total}`);

    // 4) Admin posts "fechados" (que o usuario esperaria ver): detalhe.
    const r4 = await client.query(`
        SELECT
            COUNT(*) FILTER (WHERE consensus_reached = TRUE)::int AS reached_true,
            COUNT(*) FILTER (WHERE consensus_status <> 'open')::int AS status_not_open,
            COUNT(*) FILTER (WHERE consensus_reached = TRUE AND consensus_status = 'open')::int AS reached_true_open,
            COUNT(*) FILTER (WHERE consensus_reached = FALSE AND consensus_status <> 'open')::int AS not_reached_not_open
        FROM public.news_tasks
        WHERE is_admin_post = TRUE
    `);
    console.log('\nAdmin posts nao-visiveis por motivo:');
    console.log(`  consensus_reached = TRUE:              ${r4.rows[0].reached_true}`);
    console.log(`  consensus_status <> 'open':            ${r4.rows[0].status_not_open}`);
    console.log(`  reached=TRUE AND status=open:          ${r4.rows[0].reached_true_open}`);
    console.log(`  reached=FALSE AND status<>open:        ${r4.rows[0].not_reached_not_open}`);

    // 5) Amostra de admin posts fechados recentes.
    const r5 = await client.query(`
        SELECT
            id,
            consensus_reached,
            consensus_status,
            consensus_settled_at,
            cycle_number,
            cycle_start_at,
            created_at,
            content->>'title' AS titulo
        FROM public.news_tasks
        WHERE is_admin_post = TRUE
          AND (consensus_reached = TRUE OR consensus_status <> 'open')
        ORDER BY created_at DESC
        LIMIT 10
    `);
    console.log('\nAmostra de ADMIN POSTS FECHADOS (ultimos 10):');
    r5.rows.forEach(r =>
        console.log(
            `  reached=${r.consensus_reached} status=${r.consensus_status} cycle#${r.cycle_number} ` +
            `created=${r.created_at?.toISOString?.() || r.created_at} | ${String(r.titulo || '').slice(0, 60)}`
        )
    );

    // 6) Distribuição por ciclo (admin posts).
    const r6 = await client.query(`
        SELECT
            cycle_number,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE consensus_reached = FALSE AND consensus_status = 'open')::int AS visiveis,
            COUNT(*) FILTER (WHERE consensus_reached = TRUE OR consensus_status <> 'open')::int AS fechados
        FROM public.news_tasks
        WHERE is_admin_post = TRUE
        GROUP BY 1
        ORDER BY 1 DESC
        LIMIT 12
    `);
    console.log('\nPor ciclo (ultimos 12):');
    console.log('  cycle |  total | visiveis | fechados');
    r6.rows.forEach(r => console.log(`  ${String(r.cycle_number).padStart(5)} | ${String(r.total).padStart(6)} | ${String(r.visiveis).padStart(8)} | ${String(r.fechados).padStart(8)}`));

    // 7) Existe coluna "expires_at" ou algo que poderia ter desativado? Verificar colunas.
    const r7 = await client.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'news_tasks'
        ORDER BY ordinal_position
    `);
    console.log('\nColunas de news_tasks:');
    r7.rows.forEach(r => console.log(`  ${r.column_name.padEnd(28)} ${r.data_type}`));

    await client.end();
}

run().catch(e => { console.error('Erro:', e.message || e); process.exit(1); });
