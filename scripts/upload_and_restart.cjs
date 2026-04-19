const { NodeSSH } = require('node-ssh');
const path = require('path');
const ssh = new NodeSSH();

async function main() {
  const keyPath = path.join(process.env.USERPROFILE || process.env.HOME, '.ssh', 'id_ed25519');
  await ssh.connect({ host: '72.60.53.191', username: 'root', privateKeyPath: keyPath });

  // 1. Upload the proper start_worker.cjs
  console.log('=== UPLOADING start.cjs ===');
  await ssh.putFile(
    path.resolve('scripts/start_worker.cjs'),
    '/var/www/fatopago-worker/start.cjs'
  );
  console.log('  Uploaded');

  // 2. Verify it's valid
  const check = await ssh.execCommand('node -c /var/www/fatopago-worker/start.cjs 2>&1');
  console.log('  Syntax check:', check.stdout || check.stderr || 'OK');

  // 3. Stop old, start new
  console.log('\n=== RESTARTING ===');
  await ssh.execCommand('pm2 delete fatopago-news 2>/dev/null');
  const start = await ssh.execCommand(
    'cd /var/www/fatopago-worker && pm2 start start.cjs --name fatopago-news --cwd /var/www/fatopago-worker && pm2 save'
  );
  console.log(start.stdout || start.stderr);

  // 4. Wait for first tick
  console.log('\n=== WAITING 25s FOR FIRST TICK... ===');
  await new Promise(r => setTimeout(r, 25000));

  // 5. Check logs
  const logs = await ssh.execCommand('pm2 logs fatopago-news --nostream --lines 15 2>&1');
  console.log(logs.stdout || logs.stderr);

  // 6. PM2 status
  console.log('\n=== PM2 STATUS ===');
  const pm2 = await ssh.execCommand('pm2 list');
  console.log(pm2.stdout);

  ssh.dispose();
}

main().catch(e => { console.error(e.message); process.exit(1); });
