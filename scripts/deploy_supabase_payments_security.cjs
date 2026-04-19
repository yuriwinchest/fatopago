/*
  Deploy Mercado Pago PIX security hardening to Supabase.

  Requirements (env):
  - SUPABASE_ACCESS_TOKEN (required)
  - SUPABASE_PROJECT_REF (optional; derived from VITE_SUPABASE_URL/SUPABASE_URL if missing)
  - SUPABASE_DB_PASSWORD (optional; only needed for `supabase db push`)

  Notes:
  - Does not print secrets.
  - Safe to re-run (idempotent-ish); `link` and deploy are repeatable.
*/

const path = require('path');
const { spawnSync } = require('child_process');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

function pick(...vals) {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

function deriveProjectRefFromUrl(url) {
  try {
    const u = new URL(url);
    // https://<ref>.supabase.co
    const host = String(u.host || '');
    const m = host.match(/^([a-z0-9]+)\.supabase\.co$/i);
    return m ? m[1] : '';
  } catch {
    return '';
  }
}

function run(cmd, args, extraEnv = {}) {
  const r = spawnSync(cmd, args, {
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
    shell: process.platform === 'win32',
  });
  if (r.status !== 0) {
    throw new Error(`Command failed (${r.status}): ${cmd} ${args.join(' ')}`);
  }
}

async function main() {
  const accessToken = pick(process.env.SUPABASE_ACCESS_TOKEN);
  if (!accessToken) {
    throw new Error('Missing SUPABASE_ACCESS_TOKEN. Set it in .env.local or environment.');
  }

  const supabaseUrl = pick(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_URL);
  const projectRef = pick(
    process.env.SUPABASE_PROJECT_REF,
    deriveProjectRefFromUrl(supabaseUrl),
  );
  if (!projectRef) {
    throw new Error('Missing SUPABASE_PROJECT_REF and could not derive from SUPABASE_URL/VITE_SUPABASE_URL.');
  }

  const dbPassword = pick(process.env.SUPABASE_DB_PASSWORD);

  const envForCli = {
    SUPABASE_ACCESS_TOKEN: accessToken,
  };

  // Link (creates .supabase/ config).
  run('supabase', ['link', '--project-ref', projectRef], envForCli);

  // Apply migrations if password provided; otherwise keep the deploy non-blocking.
  const canPushMigrations = Boolean(dbPassword);
  if (dbPassword) {
    run('supabase', ['db', 'push', '--password', dbPassword], envForCli);
  } else {
    console.log('\n[info] SUPABASE_DB_PASSWORD not set; skipping `supabase db push`.');
    console.log('[info] Apply migrations separately before using withdrawals (request_pix_withdrawal RPC).');
  }

  // Deploy only the payment-related functions.
  run('supabase', ['functions', 'deploy', 'mercadopago-create-pix'], envForCli);
  run('supabase', ['functions', 'deploy', 'mercadopago-check-payment'], envForCli);
  run('supabase', ['functions', 'deploy', 'mercadopago-webhook'], envForCli);

  // The withdraw function depends on the DB RPC. Avoid breaking production if migrations weren't applied.
  if (canPushMigrations) {
    run('supabase', ['functions', 'deploy', 'mercadopago-pix-withdraw'], envForCli);
  } else {
    console.log('[info] Skipping mercadopago-pix-withdraw deploy because migrations were not applied.');
  }
}

main().catch((err) => {
  console.error('deploy_supabase_payments_security failed:', err?.message || err);
  process.exit(1);
});
