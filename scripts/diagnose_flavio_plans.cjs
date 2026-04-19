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
    const userId = '3c4201cc-782b-480c-b238-4bebde9e6478';

    // plan_purchases colunas
    const cols = await client.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name='plan_purchases'
        ORDER BY ordinal_position
    `);
    console.log('plan_purchases cols:', cols.rows.map(r => r.column_name).join(', '));

    // Todas plan_purchases do Flavio
    const pp = await client.query(`
        SELECT * FROM public.plan_purchases
        WHERE user_id = $1
        ORDER BY started_at DESC NULLS LAST, created_at DESC NULLS LAST
    `, [userId]);
    console.log(`\nTODAS PLAN_PURCHASES DO FLAVIO (${pp.rows.length}):`);
    pp.rows.forEach(r => {
        console.log('  ---');
        Object.entries(r).forEach(([k, v]) => {
            const vv = v instanceof Date ? v.toISOString() : v;
            console.log(`    ${k}: ${vv}`);
        });
    });

    // Tabelas que parecem pagamento
    const t = await client.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema='public' AND (
          table_name ILIKE '%payment%' OR table_name ILIKE '%mercadopago%' OR table_name ILIKE '%order%'
          OR table_name ILIKE '%pix%' OR table_name ILIKE '%pend%'
        )
    `);
    console.log('\nTabelas candidatas a pagamento:', t.rows.map(r => r.table_name).join(', '));

    // Mercadopago / payments — tenta as mais comuns
    for (const tab of t.rows.map(r => r.table_name)) {
        try {
            const r = await client.query(`
                SELECT * FROM public.${tab}
                WHERE user_id = $1 OR metadata::text ILIKE $2
                ORDER BY created_at DESC NULLS LAST
                LIMIT 10
            `, [userId, `%${userId}%`]);
            if (r.rows.length) {
                console.log(`\n== ${tab} (${r.rows.length}) ==`);
                r.rows.forEach(row => {
                    console.log('  ---');
                    Object.entries(row).slice(0, 20).forEach(([k, v]) => {
                        const vv = v instanceof Date ? v.toISOString() : (typeof v === 'object' ? JSON.stringify(v).slice(0, 150) : String(v || '').slice(0, 200));
                        console.log(`    ${k}: ${vv}`);
                    });
                });
            }
        } catch {
            // coluna user_id pode nao existir; tenta sem
            try {
                const r = await client.query(`SELECT * FROM public.${tab} ORDER BY 1 DESC LIMIT 3`);
                if (r.rows.length) {
                    console.log(`\n== ${tab} cols ==:`, Object.keys(r.rows[0]).join(', '));
                }
            } catch {}
        }
    }

    await client.end();
}
run().catch(e => { console.error('Erro:', e.message || e); process.exit(1); });
