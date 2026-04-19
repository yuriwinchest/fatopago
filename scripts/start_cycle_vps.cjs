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

async function main() {
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
    'test -d /var/www/fatopago-worker && echo "fatopago-worker=present" || echo "fatopago-worker=missing"',
    // Start/restart the news worker using the worker .env on the VPS (so secrets never travel in commands/logs)
    'bash -lc "set -a; . /var/www/fatopago-worker/.env 2>/dev/null || true; set +a; cd /var/www/fatopago-worker && pm2 restart fatopago-news --update-env || pm2 start scripts/live_news_worker.cjs --name fatopago-news --interpreter node --time"',
    'pm2 list | head -n 30',
    'pm2 describe fatopago-news 2>/dev/null | head -n 80 || echo "pm2:fatopago-news=missing"',
    'pm2 logs fatopago-news --lines 60 --nostream 2>/dev/null || true',
    // Quick DB check (avoid nested quote escaping)
    `bash -lc 'set -a; . /var/www/fatopago-worker/.env 2>/dev/null || true; set +a; cd /var/www/fatopago-worker && node - <<NODE
(async () => {
  const { createClient } = require(\"@supabase/supabase-js\");
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error(\"SUPABASE_URL missing\");
  if (!key) throw new Error(\"SUPABASE_SERVICE_ROLE_KEY missing\");

  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await supabase
    .from(\"news_tasks\")
    .select(\"id, created_at, cycle_start_at, cycle_number\")
    .order(\"created_at\", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  console.log(JSON.stringify(data, null, 2));
})().catch((e) => {
  console.error(e && e.message ? e.message : String(e));
  process.exit(1);
});
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
  console.error('Falha ao iniciar ciclo:', err);
  try { ssh.dispose(); } catch {}
  process.exit(1);
});
