const { NodeSSH } = require('node-ssh');
const path = require('path');
const ssh = new NodeSSH();

async function main() {
  const keyPath = path.join(process.env.USERPROFILE || process.env.HOME, '.ssh', 'id_ed25519');
  await ssh.connect({ host: '72.60.53.191', username: 'root', privateKeyPath: keyPath });

  // Get full error log
  console.log('=== FULL ERROR LOG (last 50 lines) ===');
  const errLog = await ssh.execCommand('cat /root/.pm2/logs/fatopago-news-error.log | tail -50');
  console.log(errLog.stdout || errLog.stderr);

  // Try running manually to see the actual error
  console.log('\n=== MANUAL RUN TEST ===');
  const manual = await ssh.execCommand('cd /var/www/fatopago-worker && node start.cjs 2>&1 & PID=$!; sleep 5; kill $PID 2>/dev/null; wait $PID 2>/dev/null');
  console.log(manual.stdout || manual.stderr);

  ssh.dispose();
}

main().catch(e => { console.error(e.message); process.exit(1); });
