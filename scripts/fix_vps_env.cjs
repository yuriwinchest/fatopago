const { NodeSSH } = require('node-ssh');
const path = require('path');
const ssh = new NodeSSH();

async function main() {
  const keyPath = path.join(process.env.USERPROFILE || process.env.HOME, '.ssh', 'id_ed25519');
  await ssh.connect({ host: '72.60.53.191', username: 'root', privateKeyPath: keyPath });

  // 1. Check what the .env has
  console.log('=== CURRENT .env VARIABLE NAMES ===');
  const envNames = await ssh.execCommand('cat /var/www/fatopago-worker/.env | cut -d= -f1');
  console.log(envNames.stdout);

  // 2. Check what the news_ingest.cjs expects
  console.log('=== VARIABLES EXPECTED BY news_ingest.cjs ===');
  const expected = await ssh.execCommand('grep -oP "process\.env\.[A-Z_]+" /var/www/fatopago-worker/scripts/news_ingest.cjs | sort -u');
  console.log(expected.stdout);

  // 3. Check what live_news_worker.cjs expects
  console.log('=== VARIABLES EXPECTED BY live_news_worker.cjs ===');
  const workerExpected = await ssh.execCommand('grep -oP "process\.env\.[A-Z_]+" /var/www/fatopago-worker/scripts/live_news_worker.cjs | sort -u');
  console.log(workerExpected.stdout);

  // 4. Read the actual .env content (redact values)
  console.log('=== FULL .env (values redacted) ===');
  const fullEnv = await ssh.execCommand('cat /var/www/fatopago-worker/.env');
  const lines = fullEnv.stdout.split('\n');
  lines.forEach(l => {
    if (l.includes('=')) {
      const [key, ...rest] = l.split('=');
      const val = rest.join('=');
      console.log(`  ${key}=${val.substring(0, 3)}...${val.substring(val.length-3)}`);
    }
  });

  ssh.dispose();
}

main().catch(e => { console.error(e.message); process.exit(1); });
