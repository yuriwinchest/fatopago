const { NodeSSH } = require('node-ssh');
const path = require('path');

const ssh = new NodeSSH();

const host = process.env.VPS_HOST;
const username = process.env.VPS_USER;
const password = process.env.VPS_PASSWORD;
const privateKey = process.env.VPS_KEY_PATH;
const port = process.env.VPS_PORT ? Number(process.env.VPS_PORT) : undefined;

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!host || !username) throw new Error('Defina VPS_HOST e VPS_USER no ambiente.');
if (!privateKey && !password) throw new Error('Defina VPS_KEY_PATH (recomendado) ou VPS_PASSWORD no ambiente.');
if (!supabaseUrl || !serviceKey) {
  throw new Error('Defina SUPABASE_URL (ou VITE_SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY no ambiente.');
}

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
  });

  await ssh.execCommand(`mkdir -p ${appDir}/scripts`);
  await ssh.putFile(localIngest, `${appDir}/scripts/news_ingest.cjs`);
  await ssh.putFile(localWorker, `${appDir}/scripts/live_news_worker.cjs`);

  const hasEnv = Boolean(supabaseUrl && serviceKey);
  const envPrefix = hasEnv
    ? `SUPABASE_URL=${JSON.stringify(supabaseUrl)} SUPABASE_SERVICE_ROLE_KEY=${JSON.stringify(serviceKey)} `
    : '';
  const cmd = `${envPrefix}pm2 restart fatopago-news${hasEnv ? ' --update-env' : ''}`;
  const res = await ssh.execCommand(cmd, { cwd: appDir });
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
