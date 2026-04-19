const { Client } = require('pg');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function run() {
    const password = process.env.SUPABASE_DB_PASSWORD;
    if (!password) throw new Error('SUPABASE_DB_PASSWORD nao definido.');

    const client = new Client({
        host: 'aws-1-us-east-1.pooler.supabase.com',
        port: 6543,
        user: 'postgres.raxjzfvunjxqbxswuipp',
        password,
        database: 'postgres',
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 15000,
        statement_timeout: 60000,
    });

    await client.connect();
    console.log('Conectado.\n');

    // Pool disponivel agora (o que o hub vai servir).
    const r1 = await client.query(`
        SELECT COUNT(*)::int AS total
        FROM public.news_tasks
        WHERE is_admin_post = TRUE
          AND consensus_reached = FALSE
          AND consensus_status = 'open'
    `);
    console.log(`POOL ADMIN ABERTO (disponivel no hub agora): ${r1.rows[0].total}`);

    // Por categoria.
    const r2 = await client.query(`
        SELECT COALESCE(content->>'category', '—') AS categoria, COUNT(*)::int AS n
        FROM public.news_tasks
        WHERE is_admin_post = TRUE
          AND consensus_reached = FALSE
          AND consensus_status = 'open'
        GROUP BY 1
        ORDER BY 2 DESC
    `);
    console.log('\nPor categoria:');
    r2.rows.forEach(r => console.log(`  ${r.categoria.padEnd(22)} ${r.n}`));

    // Ultima admin criada.
    const r3 = await client.query(`
        SELECT created_at, content->>'title' AS titulo
        FROM public.news_tasks
        WHERE is_admin_post = TRUE
        ORDER BY created_at DESC
        LIMIT 5
    `);
    console.log('\nUltimas 5 noticias admin cadastradas:');
    r3.rows.forEach(r => console.log(`  ${new Date(r.created_at).toISOString()} | ${String(r.titulo || '').slice(0, 70)}`));

    // Scraped legado que agora ficou invisivel (apenas informativo).
    const r4 = await client.query(`
        SELECT COUNT(*)::int AS total
        FROM public.news_tasks
        WHERE is_admin_post = FALSE
          AND consensus_reached = FALSE
          AND consensus_status = 'open'
    `);
    console.log(`\nScraped legado ainda aberto no banco (invisivel no hub agora): ${r4.rows[0].total}`);

    // Referencia de demanda: pacote medio vendido. Quantos usuarios com plano ativo?
    const r5 = await client.query(`
        SELECT COUNT(*)::int AS ativos
        FROM public.plan_purchases
        WHERE status IN ('active', 'approved')
          AND (expires_at IS NULL OR expires_at > NOW())
    `).catch(() => ({ rows: [{ ativos: null }] }));
    if (r5.rows[0].ativos !== null) {
        console.log(`\nPlanos ativos agora: ${r5.rows[0].ativos}`);
    }

    await client.end();
}

run().catch(e => { console.error('Erro:', e.message || e); process.exit(1); });
