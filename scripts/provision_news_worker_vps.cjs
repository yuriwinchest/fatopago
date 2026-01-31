const { NodeSSH } = require('node-ssh');
const path = require('path');

const ssh = new NodeSSH();

const host = process.env.VPS_HOST;
const username = process.env.VPS_USER;
const password = process.env.VPS_PASSWORD;
const privateKey = process.env.VPS_KEY_PATH;
const port = process.env.VPS_PORT ? Number(process.env.VPS_PORT) : undefined;

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!host || !username) throw new Error('Defina VPS_HOST e VPS_USER no ambiente.');
if (!privateKey && !password) throw new Error('Defina VPS_KEY_PATH (recomendado) ou VPS_PASSWORD no ambiente.');
if (!supabaseUrl || !serviceKey) {
  throw new Error('Defina SUPABASE_URL (ou VITE_SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY no ambiente.');
}

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
  });

  await ssh.execCommand(`mkdir -p ${workerDir}`);
  await ssh.execCommand(`mkdir -p ${workerDir}/scripts`);

  const writePkg = `cat <<'EOF' > ${workerDir}/package.json\n${JSON.stringify(packageJson, null, 2)}\nEOF`;
  await ssh.execCommand(writePkg);

  await ssh.putFile(localIngest, `${workerDir}/scripts/news_ingest.cjs`);
  await ssh.putFile(localWorker, `${workerDir}/scripts/live_news_worker.cjs`);

  await ssh.execCommand('npm install --omit=dev', { cwd: workerDir });

  const envPrefix = `SUPABASE_URL='${supabaseUrl}' SUPABASE_SERVICE_ROLE_KEY='${serviceKey}' `;
  const cmd = `${envPrefix}pm2 restart fatopago-news --update-env || ${envPrefix}pm2 start "node scripts/live_news_worker.cjs" --name fatopago-news --time`;
  const res = await ssh.execCommand(cmd, { cwd: workerDir });
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
