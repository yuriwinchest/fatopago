const { NodeSSH } = require('node-ssh');
const path = require('path');
const fs = require('fs');
const os = require('os');

const ssh = new NodeSSH();

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

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

const appDir = process.env.VPS_NEWS_WORKER_DIR || '/var/www/fatopago-worker';
const localIngest = path.join(__dirname, 'news_ingest.cjs');
const localWorker = path.join(__dirname, 'live_news_worker.cjs');

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

  await ssh.execCommand(`mkdir -p ${appDir}/scripts`);
  await ssh.putFile(localIngest, `${appDir}/scripts/news_ingest.cjs`);
  await ssh.putFile(localWorker, `${appDir}/scripts/live_news_worker.cjs`);

  // Restart without passing secrets on the command line; rely on ${appDir}/.env on the VPS.
  const cmd =
    `bash -lc 'set -a; ` +
    `. ${appDir}/.env 2>/dev/null || true; ` +
    `set +a; ` +
    `cd ${appDir} && pm2 restart fatopago-news --update-env || true'`;
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
