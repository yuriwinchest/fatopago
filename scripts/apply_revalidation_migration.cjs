const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const MIGRATION_FILE = path.resolve(
    __dirname,
    '../supabase/migrations/20260415120000_allow_revalidation_across_packages.sql'
);

async function run() {
    const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
    console.log(`Aplicando ${path.basename(MIGRATION_FILE)} no banco remoto...`);

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
        statement_timeout: 300000,
    });

    await client.connect();
    console.log('Conectado (pooler tx).');
    await client.query(sql);
    console.log('SUCESSO: migration aplicada.');
    await client.end();
}

run().catch((err) => {
    console.error('Erro fatal:', err.message || err);
    process.exit(1);
});
