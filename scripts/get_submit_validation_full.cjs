const { Client } = require('pg');
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });

const client = new Client({
  host: 'db.raxjzfvunjxqbxswuipp.supabase.co',
  port: 5432, database: 'postgres', user: 'postgres',
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  const { rows } = await client.query(`
    SELECT pg_get_functiondef(oid) AS def
    FROM pg_proc
    WHERE proname = 'submit_validation'
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ORDER BY pronargs DESC LIMIT 1
  `);
  console.log(rows[0].def);
  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
