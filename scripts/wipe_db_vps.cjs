const { NodeSSH } = require('node-ssh');
const path = require('path');
const fs = require('fs');
const os = require('os');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const ssh = new NodeSSH();

const host = process.env.VPS_HOST;
if (!host) throw new Error('VPS_HOST environment variable is required');
const username = process.env.VPS_USER || 'root';
const password = process.env.VPS_PASSWORD;
const defaultKeyPath = path.join(os.homedir(), '.ssh', 'fatopago_key');
const privateKeyRaw = process.env.VPS_KEY_PATH || (fs.existsSync(defaultKeyPath) ? defaultKeyPath : undefined);
const privateKey =
  privateKeyRaw &&
  typeof privateKeyRaw === 'string' &&
  !privateKeyRaw.includes('BEGIN') &&
  fs.existsSync(privateKeyRaw)
    ? fs.readFileSync(privateKeyRaw, 'utf8')
    : privateKeyRaw;
const port = process.env.VPS_PORT ? Number(process.env.VPS_PORT) : undefined;

if (!privateKey && !password) {
  throw new Error('Defina VPS_KEY_PATH (recomendado) ou VPS_PASSWORD no ambiente.');
}

const workerDir = process.env.VPS_NEWS_WORKER_DIR || '/var/www/fatopago-worker';

function requireYesFlag() {
  const args = process.argv.slice(2);
  if (!args.includes('--yes')) {
    console.log('Operacao destrutiva. Para APAGAR DADOS + USUARIOS, execute: node scripts/wipe_db_vps.cjs --yes');
    process.exit(1);
  }
}

async function main() {
  requireYesFlag();

  await ssh.connect({
    host,
    username,
    port,
    ...(privateKey ? { privateKey } : { password }),
    tryKeyboard: true,
    readyTimeout: 30000,
    keepaliveInterval: 10000,
  });

  const cmds = [
    'date -u',
    `test -f ${workerDir}/.env && echo "worker:.env=present" || echo "worker:.env=MISSING"`,
    `stat -c "%a %U:%G %n" ${workerDir}/.env 2>/dev/null || true`,
    // Wipe using service role key that lives ONLY in worker .env on the VPS.
    `bash -lc 'set -a; . ${workerDir}/.env 2>/dev/null || true; set +a; cd ${workerDir} && node - <<\\'NODE\\'
(async () => {
  const { createClient } = require("@supabase/supabase-js");

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl) throw new Error("SUPABASE_URL/VITE_SUPABASE_URL missing");
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  async function countRows(table) {
    const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
    if (error) return { table, count: null, error: error.message };
    return { table, count, error: null };
  }

  async function deleteAllRows(table) {
    // Supabase/PostgREST usually requires a WHERE clause for DELETE.
    // Try common columns; if the column doesn't exist, try the next one.
    const filters = [
      ["id", "is", null],
      ["created_at", "is", null],
      ["user_id", "is", null],
      ["task_id", "is", null],
      ["referrer_id", "is", null],
      ["referred_id", "is", null],
      ["mp_payment_id", "is", null],
    ];

    let lastErr = null;
    for (const [col, op, val] of filters) {
      const { error } = await supabase.from(table).delete().not(col, op, val);
      if (!error) return { table, ok: true, error: null, where: col + " NOT " + op + " " + String(val) };

      const msg = error.message || String(error);
      lastErr = msg;
      // Unknown column: try next filter.
      if (msg.includes("does not exist") || msg.includes("column") || msg.includes("42703")) continue;
      return { table, ok: false, error: msg };
    }
    return { table, ok: false, error: lastErr || "No known filter column found." };
  }

  async function wipeAllUsers() {
    let deleted = 0;
    let page = 1;
    const perPage = 200;
    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
      if (error) throw new Error("listUsers: " + error.message);
      const users = (data && data.users) || [];
      if (users.length === 0) break;

      for (const user of users) {
        const res = await supabase.auth.admin.deleteUser(user.id);
        if (res.error) throw new Error("deleteUser(" + user.id + "): " + res.error.message);
        deleted += 1;
      }
      page += 1;
    }
    return deleted;
  }

  // Order matters (children first).
  const tables = [
    "validations",
    "pix_withdrawals",
    "pix_payments",
    "transactions",
    "commissions",
    "referrals",
    "plan_purchases",
    "profiles",
    "news_tasks",
  ];

  console.log("Counts (before):");
  for (const t of tables) {
    const r = await countRows(t);
    console.log("- " + t + ": " + (r.error ? ("err(" + r.error + ")") : String(r.count)));
  }

  console.log("\\nWiping tables...");
  for (const t of tables) {
    const r = await deleteAllRows(t);
    console.log("- " + t + ": " + (r.ok ? "ok" : ("err(" + r.error + ")")));
  }

  console.log("\\nDeleting all auth users...");
  const deletedUsers = await wipeAllUsers();
  console.log("- users_deleted: " + String(deletedUsers));

  console.log("\\nCounts (after):");
  for (const t of tables) {
    const r = await countRows(t);
    console.log("- " + t + ": " + (r.error ? ("err(" + r.error + ")") : String(r.count)));
  }
})();
NODE'`,
  ];

  for (const cmd of cmds) {
    console.log(`\n===== ${cmd} =====`);
    const r = await ssh.execCommand(cmd, { execOptions: { pty: true } });
    if (r.stdout) console.log(r.stdout.trimEnd());
    if (r.stderr) console.error(r.stderr.trimEnd());
  }

  ssh.dispose();
}

main().catch((err) => {
  console.error('Falha ao limpar banco na VPS:', err?.message || err);
  try { ssh.dispose(); } catch {}
  process.exit(1);
});
