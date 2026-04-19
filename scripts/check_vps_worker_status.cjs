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
  });

  const cmds = [
    'date -u',
    'ls -lah /var/www/fatopago-worker 2>/dev/null || echo "fatopago-worker:missing"',
    'ls -lah /var/www/fatopago-worker/scripts 2>/dev/null || true',
    'bash -lc \'test -f /var/www/fatopago/.env && (grep -E "^(SUPABASE|VITE_SUPABASE)_" /var/www/fatopago/.env | cut -d= -f1 | sort -u | head -n 50) || echo "fatopago:.env=missing"\'',
    'pm2 list',
    'bash -lc \'pm2 env fatopago 2>/dev/null | grep -q "SUPABASE_SERVICE_ROLE_KEY" && echo "pm2:fatopago_has_service_role_key=yes" || echo "pm2:fatopago_has_service_role_key=no"\'' ,
    'pm2 describe fatopago-news 2>/dev/null | head -n 60 || echo "pm2:fatopago-news=missing"',
  ];

  for (const cmd of cmds) {
    console.log(`\n===== ${cmd} =====`);
    const r = await ssh.execCommand(cmd);
    if (r.stdout) console.log(r.stdout.trimEnd());
    if (r.stderr) console.error(r.stderr.trimEnd());
  }

  ssh.dispose();
}

main().catch((err) => {
  console.error('Falha ao checar worker:', err);
  try { ssh.dispose(); } catch {}
  process.exit(1);
});
