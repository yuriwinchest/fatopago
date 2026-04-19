const { NodeSSH } = require('node-ssh');
const path = require('path');
const fs = require('fs');
const ssh = new NodeSSH();

async function main() {
  const keyPath = path.join(process.env.USERPROFILE || process.env.HOME, '.ssh', 'id_ed25519');
  await ssh.connect({ host: '72.60.53.191', username: 'root', privateKeyPath: keyPath });
  console.log('Connected to VPS\n');

  // 1. Check worker scripts directory
  console.log('=== WORKER SCRIPTS ===');
  const scripts = await ssh.execCommand('ls -la /var/www/fatopago-worker/scripts/ 2>/dev/null');
  console.log(scripts.stdout || scripts.stderr);

  // 2. Check .env on VPS
  console.log('\n=== WORKER .env (keys redacted) ===');
  const env = await ssh.execCommand('cat /var/www/fatopago-worker/.env 2>/dev/null | sed "s/=.*/=***/"');
  console.log(env.stdout || env.stderr);

  // 3. Upload latest news_ingest.cjs and live_news_worker.cjs
  console.log('\n=== UPLOADING LATEST SCRIPTS ===');

  const localNewsIngest = path.resolve('scripts/news_ingest.cjs');
  const localWorker = path.resolve('scripts/live_news_worker.cjs');

  if (fs.existsSync(localNewsIngest)) {
    await ssh.putFile(localNewsIngest, '/var/www/fatopago-worker/scripts/news_ingest.cjs');
    console.log('  Uploaded news_ingest.cjs');
  } else {
    console.log('  news_ingest.cjs not found locally!');
  }

  if (fs.existsSync(localWorker)) {
    await ssh.putFile(localWorker, '/var/www/fatopago-worker/scripts/live_news_worker.cjs');
    console.log('  Uploaded live_news_worker.cjs');
  } else {
    console.log('  live_news_worker.cjs not found locally!');
  }

  // 4. Start/restart the worker
  console.log('\n=== STARTING NEWS WORKER ===');
  const start = await ssh.execCommand(
    'cd /var/www/fatopago-worker && pm2 delete fatopago-news 2>/dev/null; pm2 start scripts/live_news_worker.cjs --name fatopago-news --cwd /var/www/fatopago-worker && pm2 save'
  );
  console.log(start.stdout || start.stderr);

  // 5. Wait and check logs
  console.log('\n=== WAITING 15s FOR FIRST RUN... ===');
  await new Promise(r => setTimeout(r, 15000));

  const logs = await ssh.execCommand('pm2 logs fatopago-news --nostream --lines 30 2>&1');
  console.log(logs.stdout || logs.stderr);

  // 6. Final PM2 status
  console.log('\n=== PM2 STATUS FINAL ===');
  const pm2 = await ssh.execCommand('pm2 list');
  console.log(pm2.stdout);

  ssh.dispose();
}

main().catch(e => { console.error(e.message); process.exit(1); });
