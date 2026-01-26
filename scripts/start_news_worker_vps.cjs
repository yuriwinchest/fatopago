const { NodeSSH } = require('node-ssh');

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
if (!supabaseUrl) throw new Error('Defina SUPABASE_URL (ou VITE_SUPABASE_URL) no ambiente.');
if (!serviceKey) throw new Error('Defina SUPABASE_SERVICE_ROLE_KEY no ambiente.');

const appDir = process.env.VPS_APP_DIR || '/var/www/fatopago';

async function main() {
  await ssh.connect({
    host,
    username,
    port,
    ...(privateKey ? { privateKey } : { password }),
    tryKeyboard: true,
  });

  const envPrefix = `SUPABASE_URL='${supabaseUrl}' SUPABASE_SERVICE_ROLE_KEY='${serviceKey}'`;
  const cmd = `${envPrefix} pm2 restart fatopago-news --update-env || ${envPrefix} pm2 start \"node scripts/live_news_worker.cjs\" --name fatopago-news --time`;

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

