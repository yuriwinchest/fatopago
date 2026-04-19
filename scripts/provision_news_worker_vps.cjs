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

const workerDir = process.env.VPS_NEWS_WORKER_DIR || '/var/www/fatopago-worker';
const localIngest = path.join(__dirname, 'news_ingest.cjs');
const localWorker = path.join(__dirname, 'live_news_worker.cjs');

const packageJson = {
  name: 'fatopago-news-worker',
  private: true,
  version: '1.0.0',
  type: 'commonjs',
  dependencies: {
    '@supabase/supabase-js': '^2.39.0',
    'rss-parser': '^3.13.0'
  }
};

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

  await ssh.execCommand(`mkdir -p ${workerDir}`);
  await ssh.execCommand(`mkdir -p ${workerDir}/scripts`);

  const writePkg = `cat <<'EOF' > ${workerDir}/package.json\n${JSON.stringify(packageJson, null, 2)}\nEOF`;
  await ssh.execCommand(writePkg);

  await ssh.putFile(localIngest, `${workerDir}/scripts/news_ingest.cjs`);
  await ssh.putFile(localWorker, `${workerDir}/scripts/live_news_worker.cjs`);

  await ssh.execCommand('npm install --omit=dev', { cwd: workerDir });

  // Start/restart using ${workerDir}/.env on the VPS; never pass secrets via command line.
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
  console.error('Falha ao provisionar worker:', err);
  try {
    ssh.dispose();
  } catch {}
  process.exit(1);
});
