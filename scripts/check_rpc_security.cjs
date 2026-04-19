const { Client } = require('pg');
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });

const client = new Client({
  host: 'db.raxjzfvunjxqbxswuipp.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();

  // Check if these RPCs verify auth.uid() internally
  const rpcs = ['submit_validation', 'request_pix_withdrawal', 'close_user_account', 'consume_rate_limit', 'is_cpf_registered'];

  for (const name of rpcs) {
    const { rows } = await client.query(`
      SELECT prosrc FROM pg_proc
      WHERE proname = $1 AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      LIMIT 1
    `, [name]);

    if (rows.length === 0) {
      console.log(`\n=== ${name} === NOT FOUND`);
      continue;
    }

    const src = rows[0].prosrc;
    const hasAuthCheck = /auth\.uid\(\)/i.test(src);
    const hasRoleCheck = /current_setting.*role/i.test(src) || /assert_fatopago_admin/i.test(src);
    const hasRateLimit = /consume_rate_limit/i.test(src);

    console.log(`\n=== ${name} ===`);
    console.log(`  auth.uid() check: ${hasAuthCheck ? 'YES' : 'NO'}`);
    console.log(`  role/admin check: ${hasRoleCheck ? 'YES' : 'NO'}`);
    console.log(`  rate limiting: ${hasRateLimit ? 'YES' : 'NO'}`);

    // Show first few lines with auth checks
    const lines = src.split('\n');
    const authLines = lines.filter((l, i) => /auth\.uid|RAISE EXCEPTION|IF.*NULL/i.test(l));
    if (authLines.length > 0) {
      console.log(`  Auth-relevant lines:`);
      authLines.slice(0, 5).forEach(l => console.log(`    ${l.trim()}`));
    }
  }

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
