const { NodeSSH } = require('node-ssh');
const path = require('path');
const ssh = new NodeSSH();

async function main() {
  const keyPath = path.join(process.env.USERPROFILE || process.env.HOME, '.ssh', 'id_ed25519');
  await ssh.connect({ host: '72.60.53.191', username: 'root', privateKeyPath: keyPath });

  // 1. Check raw .env for quoting issues
  console.log('=== RAW .env (hex dump of first key) ===');
  const raw = await ssh.execCommand('cat /var/www/fatopago-worker/.env');
  const envContent = raw.stdout;
  // Check if values are quoted
  const lines = envContent.split('\n').filter(l => l.includes('SUPABASE'));
  lines.forEach(l => {
    console.log(`  RAW: [${l}]`);
    console.log(`  Has quotes: ${l.includes('"')}`);
  });

  // 2. Strip quotes from .env if present and recreate
  console.log('\n=== FIXING .env (removing quotes) ===');
  const fixedEnv = envContent
    .split('\n')
    .map(line => {
      if (line.includes('=')) {
        const eqIdx = line.indexOf('=');
        const key = line.substring(0, eqIdx);
        let val = line.substring(eqIdx + 1).trim();
        // Remove surrounding quotes
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        return `${key}=${val}`;
      }
      return line;
    })
    .join('\n');

  await ssh.execCommand(`cat > /var/www/fatopago-worker/.env << 'ENVEOF'
${fixedEnv}
ENVEOF`);
  await ssh.execCommand('chmod 600 /var/www/fatopago-worker/.env');
  console.log('  .env rewritten without quotes');

  // 3. Verify the .env is readable
  const verify = await ssh.execCommand('cat /var/www/fatopago-worker/.env | head -2');
  console.log(`  First 2 lines: ${verify.stdout}`);

  // 4. Restart with --env from file explicitly
  console.log('\n=== RESTARTING WITH node --env-file ===');
  // PM2 ecosystem approach: pass env_file
  await ssh.execCommand('pm2 delete fatopago-news 2>/dev/null');

  // Create a small wrapper that loads .env first
  await ssh.execCommand(`cat > /var/www/fatopago-worker/start.cjs << 'EOF'
const fs = require('fs');
const path = require('path');
// Load .env manually
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const eqIdx = line.indexOf('=');
    if (eqIdx > 0 && !line.startsWith('#')) {
      const key = line.substring(0, eqIdx).trim();
      let val = line.substring(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}
require('./scripts/live_news_worker.cjs');
EOF`);

  const start = await ssh.execCommand(
    'cd /var/www/fatopago-worker && pm2 start start.cjs --name fatopago-news --cwd /var/www/fatopago-worker && pm2 save'
  );
  console.log(start.stdout || start.stderr);

  // 5. Wait for first tick
  console.log('\n=== WAITING 20s FOR FIRST TICK... ===');
  await new Promise(r => setTimeout(r, 20000));

  const logs = await ssh.execCommand('pm2 logs fatopago-news --nostream --lines 10 2>&1');
  console.log(logs.stdout || logs.stderr);

  console.log('\n=== PM2 STATUS ===');
  const pm2 = await ssh.execCommand('pm2 list');
  console.log(pm2.stdout);

  ssh.dispose();
}

main().catch(e => { console.error(e.message); process.exit(1); });
