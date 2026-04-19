const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function run() {
    const sql = fs.readFileSync(
        path.join(__dirname, '../supabase/migrations/20260416120000_admin_reveal_pix_key_and_manual_threshold.sql'),
        'utf8'
    );
    const client = new Client({
        host: 'aws-1-us-east-1.pooler.supabase.com',
        port: 6543,
        user: 'postgres.raxjzfvunjxqbxswuipp',
        password: process.env.SUPABASE_DB_PASSWORD,
        database: 'postgres',
        ssl: { rejectUnauthorized: false },
        statement_timeout: 120000,
    });
    await client.connect();
    try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        console.log('Migration 20260416120000 aplicada com sucesso.');

        // Verify admin_get_pix_withdrawal_full_key exists
        const r1 = await client.query(`
            SELECT routine_name FROM information_schema.routines
            WHERE routine_schema='public' AND routine_name='admin_get_pix_withdrawal_full_key'
        `);
        console.log('admin_get_pix_withdrawal_full_key:', r1.rows.length > 0 ? 'EXISTS' : 'MISSING');

        // Verify threshold in request_pix_withdrawal
        const r2 = await client.query(`
            SELECT pg_get_functiondef(oid) AS def
            FROM pg_proc
            WHERE proname = 'request_pix_withdrawal'
              AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
            ORDER BY pronargs DESC LIMIT 1
        `);
        const hasZeroThreshold = r2.rows[0]?.def?.includes('0.00');
        console.log('request_pix_withdrawal threshold = R$0:', hasZeroThreshold);
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('ROLLBACK:', e.message || e);
        process.exit(1);
    }
    await client.end();
}
run().catch(e => { console.error('Erro:', e.message || e); process.exit(1); });
