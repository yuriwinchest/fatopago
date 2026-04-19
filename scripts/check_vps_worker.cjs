const { NodeSSH } = require('node-ssh');
const path = require('path');
const ssh = new NodeSSH();

async function main() {
  const keyPath = path.join(process.env.USERPROFILE || process.env.HOME, '.ssh', 'id_rsa');
  try {
    await ssh.connect({ host: '72.60.53.191', username: 'root', privateKeyPath: keyPath });
  } catch(e) {
    // Try ed25519
    const keyPath2 = path.join(process.env.USERPROFILE || process.env.HOME, '.ssh', 'id_ed25519');
    try {
      await ssh.connect({ host: '72.60.53.191', username: 'root', privateKeyPath: keyPath2 });
    } catch(e2) {
      console.error('Cannot connect via SSH:', e2.message);
      console.log('\nTrying to list available SSH keys...');
      const fs = require('fs');
      const sshDir = path.join(process.env.USERPROFILE || process.env.HOME, '.ssh');
      try {
        const files = fs.readdirSync(sshDir);
        console.log('SSH keys found:', files.filter(f => !f.endsWith('.pub') && !f.includes('known') && !f.includes('config')));
      } catch(e3) {
        console.log('No .ssh directory found');
      }
      process.exit(1);
    }
  }

  console.log('=== CONNECTED TO VPS ===');

  console.log('\n=== PM2 STATUS ===');
  const pm2 = await ssh.execCommand('pm2 list 2>&1 || echo "pm2 not found"');
  console.log(pm2.stdout || pm2.stderr);

  console.log('\n=== WORKER DIRECTORY ===');
  const ls = await ssh.execCommand('ls -la /var/www/fatopago-worker/ 2>/dev/null || echo "Not found"');
  console.log(ls.stdout || ls.stderr);

  console.log('\n=== ÚLTIMAS 40 LINHAS LOG ===');
  const logs = await ssh.execCommand('pm2 logs fatopago-news --nostream --lines 40 2>&1');
  console.log(logs.stdout || logs.stderr);

  console.log('\n=== UPTIME ===');
  const uptime = await ssh.execCommand('uptime');
  console.log(uptime.stdout);

  ssh.dispose();
}

main().catch(e => { console.error(e.message); process.exit(1); });
