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
    console.log('CICLO ATUAL:', JSON.stringify(cyc.rows[0]));

    // Top 20 do ranking vivo
    const r = await client.query(`
        SELECT * FROM public.get_live_validation_ranking()
        ORDER BY validations_count DESC NULLS LAST
        LIMIT 20
    `);
    console.log('\nTOP 20 RANKING (ciclo atual):');
    if (r.rows[0]) console.log('colunas:', Object.keys(r.rows[0]).join(','));
    r.rows.forEach((u, i) => {
        console.log(`  #${i+1} ${u.name || ''} ${u.lastname || ''} => ${u.validations_count}`);
    });

    const maxCount = r.rows.length ? Number(r.rows[0].validations_count || 0) : 0;
    console.log(`\nMAX validacoes no ciclo atual: ${maxCount}`);
    console.log(`Alguem atingiu 100? ${maxCount >= 100 ? 'SIM' : 'NAO'}`);

    await client.end();
}
run().catch(e => { console.error('Erro:', e.message || e); process.exit(1); });
