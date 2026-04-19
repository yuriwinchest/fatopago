// Aplica migration 20260415120000_sync_user_validation_cycle_stats_trigger.sql
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function run() {
    const sql = fs.readFileSync(
        path.join(__dirname, '../supabase/migrations/20260415120000_sync_user_validation_cycle_stats_trigger.sql'),
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
        console.log('Migration aplicada.');

        const chk = await client.query(`
            SELECT tgname FROM pg_trigger
            WHERE tgname = 'validations_sync_cycle_stats'
        `);
        console.log('Trigger presente:', chk.rows.length > 0);
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('ROLLBACK:', e.message || e);
        process.exit(1);
    }
    await client.end();
}
run().catch(e => { console.error('Erro:', e.message || e); process.exit(1); });
