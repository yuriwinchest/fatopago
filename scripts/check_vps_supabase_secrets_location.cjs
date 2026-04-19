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
    'ls -lah /var/www/fatopago/.env* /var/www/fatopago-worker/.env* 2>/dev/null || true',
    'echo ---; grep -R -l "^SUPABASE_SERVICE_ROLE_KEY=" /var/www/fatopago /var/www/fatopago-worker 2>/dev/null | head -n 50 || true',
    'echo ---; grep -R -l "^SUPABASE_ACCESS_TOKEN=" /var/www/fatopago /var/www/fatopago-worker 2>/dev/null | head -n 50 || true',
  ];

  for (const cmd of cmds) {
    console.log(`\n===== ${cmd} =====`);
    const r = await ssh.execCommand(`bash -lc ${JSON.stringify(cmd)}`);
    if (r.stdout) console.log(r.stdout.trimEnd());
    if (r.stderr) console.error(r.stderr.trimEnd());
  }

  ssh.dispose();
}

main().catch((err) => {
  console.error('Falha ao buscar secrets no VPS:', err);
  try { ssh.dispose(); } catch {}
  process.exit(1);
});

