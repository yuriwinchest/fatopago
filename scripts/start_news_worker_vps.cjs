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

if (!privateKey && !password) throw new Error('Defina VPS_KEY_PATH (recomendado) ou VPS_PASSWORD no ambiente.');

const workerDir = process.env.VPS_NEWS_WORKER_DIR || '/var/www/fatopago-worker';

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

  // Never pass secrets via command line. Load env from the worker's .env on the VPS.
  const cmd =
    `bash -lc 'set -a; ` +
    `. ${workerDir}/.env 2>/dev/null || true; ` +
    `set +a; ` +
    `cd ${workerDir} && ` +
    `pm2 restart fatopago-news --update-env || pm2 start \"node scripts/live_news_worker.cjs\" --name fatopago-news --time'`;

  const res = await ssh.execCommand(cmd, { execOptions: { pty: true } });
  if (res.stdout) process.stdout.write(res.stdout);
  if (res.stderr) process.stderr.write(res.stderr);

  ssh.dispose();
}

main().catch((err) => {
  console.error(err);
  try {
    ssh.dispose();
  } catch {}
  process.exit(1);
});

