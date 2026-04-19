const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function run() {
    const sql = fs.readFileSync(
        path.join(__dirname, '../supabase/migrations/20260416110000_fix_withdrawal_status_rechecks_and_admin_queue.sql'),
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
        console.log('Migration 20260416110000 aplicada.');

        // Verify
        const r = await client.query(`
            SELECT pg_get_functiondef(oid) AS def
            FROM pg_proc
            WHERE proname = 'claim_pending_pix_withdrawals'
              AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
            ORDER BY pronargs DESC LIMIT 1
        `);
        const hasRecheck = r.rows[0]?.def?.includes('external_payout_id IS NOT NULL');
        console.log('claim_pending_pix_withdrawals now has status recheck:', hasRecheck);

        const r2 = await client.query(`SELECT routine_name FROM information_schema.routines WHERE routine_schema='public' AND routine_name='admin_list_pix_withdrawals'`);
        console.log('admin_list_pix_withdrawals:', r2.rows.length > 0 ? 'EXISTS' : 'MISSING');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('ROLLBACK:', e.message || e);
        process.exit(1);
    }
    await client.end();
}
run().catch(e => { console.error('Erro:', e.message || e); process.exit(1); });
