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

  // 1. Check storage buckets
  const buckets = await client.query(`SELECT id, name, public, file_size_limit, allowed_mime_types FROM storage.buckets ORDER BY name`);
  console.log('=== STORAGE BUCKETS ===');
  buckets.rows.forEach(b => console.log(`  ${b.name} | public=${b.public} | limit=${b.file_size_limit} | mimes=${JSON.stringify(b.allowed_mime_types)}`));

  // 2. Check storage policies
  const policies = await client.query(`
    SELECT policyname, tablename, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'storage'
    ORDER BY tablename, policyname
  `);
  console.log('\n=== STORAGE POLICIES ===');
  policies.rows.forEach(p => console.log(`  [${p.tablename}] ${p.policyname} (${p.cmd})`));

  // 3. Check RLS status on key tables
  const rlsCheck = await client.query(`
    SELECT schemaname, tablename, rowsecurity
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename IN (
      'profiles', 'validations', 'plan_purchases', 'transactions',
      'financial_ledger', 'commissions', 'seller_referrals', 'sellers',
      'seller_funnel_events', 'news_tasks', 'news_task_validations',
      'pix_withdrawals', 'security_alerts', 'admin_users',
      'security_rate_limits', 'referrals', 'seller_commission_credits',
      'news_task_manual_review_votes', 'mercadopago_webhook_receipts',
      'cycle_winner_followups'
    )
    ORDER BY tablename
  `);
  console.log('\n=== RLS STATUS (PUBLIC TABLES) ===');
  rlsCheck.rows.forEach(r => console.log(`  ${r.tablename}: RLS=${r.rowsecurity}`));

  // 4. Check NOT NULL constraints on profiles
  const profileCols = await client.query(`
    SELECT column_name, is_nullable, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
    AND column_name IN ('name', 'email', 'cpf', 'birth_date', 'phone', 'lastname')
    ORDER BY column_name
  `);
  console.log('\n=== PROFILES NULLABLE COLUMNS ===');
  profileCols.rows.forEach(c => console.log(`  ${c.column_name}: nullable=${c.is_nullable} type=${c.data_type}`));

  // 5. Check grants on sensitive RPCs
  const rpcGrants = await client.query(`
    SELECT routine_name, grantee, privilege_type
    FROM information_schema.routine_privileges
    WHERE routine_schema = 'public'
    AND routine_name IN (
      'submit_validation', 'activate_pix_payment', 'process_pix_payment_reversal',
      'request_pix_withdrawal', 'settle_news_task', 'close_user_account',
      'consume_rate_limit', 'is_cpf_registered'
    )
    ORDER BY routine_name, grantee
  `);
  console.log('\n=== RPC GRANTS (SENSITIVE) ===');
  rpcGrants.rows.forEach(g => console.log(`  ${g.routine_name} -> ${g.grantee} (${g.privilege_type})`));

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
