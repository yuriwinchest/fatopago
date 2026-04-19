/*
  VPS security inspection helper.

  Goals:
  - Connect via SSH using .env/.env.local (same pattern as other scripts).
  - Collect high-signal state: OS, listening ports, firewall, nginx config, PM2 processes,
    and risky filesystem permissions under /var/www.
  - Avoid printing secrets: never cat .env or dump environment variables.
*/

const path = require('path');
const fs = require('fs');
const os = require('os');
const { NodeSSH } = require('node-ssh');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const ssh = new NodeSSH();

const host = process.env.VPS_HOST;
const username = process.env.VPS_USER || 'root';
const password = process.env.VPS_PASSWORD;
// node-ssh/ssh2 expects privateKey content (not a path). Many local scripts accept a path,
// so normalize here: if VPS_KEY_PATH points to a file, read it.
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

if (!host) throw new Error('VPS_HOST environment variable is required');
if (!host || !username) throw new Error('Defina VPS_HOST e VPS_USER no ambiente.');
if (!privateKey && !password) throw new Error('Defina VPS_KEY_PATH (recomendado) ou VPS_PASSWORD no ambiente.');

async function run(cmd, opts = {}) {
  const res = await ssh.execCommand(cmd, opts);
  // Keep output readable; stderr is often noisy, but it's useful for missing commands.
  const out = (res.stdout || '').trim();
  const err = (res.stderr || '').trim();
  return { code: res.code, out, err };
}

function printSection(title) {
  console.log(`\n=== ${title} ===`);
}

async function main() {
  await ssh.connect({
    host,
    username,
    port,
    ...(privateKey ? { privateKey } : { password }),
    tryKeyboard: true,
    readyTimeout: 30000,
  });

  printSection('Identity / OS');
  for (const cmd of [
    'whoami',
    'id',
    'uname -a',
    'cat /etc/os-release 2>/dev/null | head -n 30 || true',
  ]) {
    const { out, err } = await run(cmd);
    if (out) console.log(out);
    else if (err) console.log(err);
  }

  printSection('Listening Ports');
  {
    // Prefer ss; fall back to netstat.
    const ss = await run('ss -tulpn 2>/dev/null | head -n 200 || true');
    if (ss.out) console.log(ss.out);
    else {
      const netstat = await run('netstat -tulpn 2>/dev/null | head -n 200 || true');
      console.log(netstat.out || netstat.err || '(no output)');
    }
  }

  printSection('Firewall');
  {
    const fw = await run('command -v firewall-cmd >/dev/null 2>&1 && firewall-cmd --state && firewall-cmd --list-all || echo \"firewall-cmd=missing\"');
    console.log(fw.out || fw.err || '(no output)');
    const ufw = await run('command -v ufw >/dev/null 2>&1 && ufw status verbose || echo \"ufw=missing\"');
    console.log(ufw.out || ufw.err || '(no output)');
  }

  printSection('Nginx');
  for (const cmd of [
    'nginx -v 2>&1 || true',
    'nginx -t 2>&1 || true',
    'ls -lah /etc/nginx/conf.d 2>/dev/null | head -n 200 || true',
    'echo \"--- /etc/nginx/conf.d/fatopago.com.conf ---\"; sed -n \"1,200p\" /etc/nginx/conf.d/fatopago.com.conf 2>/dev/null || echo \"missing\"',
    'echo \"--- /etc/nginx/conf.d/fazservico.conf ---\"; sed -n \"1,260p\" /etc/nginx/conf.d/fazservico.conf 2>/dev/null || echo \"missing\"',
  ]) {
    const { out } = await run(cmd);
    if (out) console.log(out);
  }

  printSection('PM2');
  {
    // IMPORTANT: do not print `pm2 jlist` raw; it contains environment variables (can include secrets).
    for (const cmd of [
      'command -v pm2 >/dev/null 2>&1 && pm2 -v || echo \"pm2=missing\"',
      'command -v pm2 >/dev/null 2>&1 && pm2 list || true',
    ]) {
      const { out } = await run(cmd);
      if (out) console.log(out);
    }

    // Print a sanitized PM2 summary (no env vars).
    const j = await run('command -v pm2 >/dev/null 2>&1 && pm2 jlist || true');
    const raw = (j.out || '').trim();
    if (raw.startsWith('[')) {
      try {
        const list = JSON.parse(raw);
        if (Array.isArray(list) && list.length) {
          console.log('\n-- PM2 sanitized summary (no env) --');
          for (const p of list.slice(0, 50)) {
            const env = p?.pm2_env || {};
            const name = p?.name || env?.name || '(unknown)';
            const pid = p?.pid ?? env?.pid ?? '-';
            const status = env?.status || p?.status || '-';
            const user = env?.username || p?.username || '-';
            const cwd = env?.pm_cwd || '-';
            const exec = env?.pm_exec_path || '-';
            console.log(`${name} pid=${pid} status=${status} user=${user}`);
            console.log(`  cwd=${cwd}`);
            console.log(`  exec=${exec}`);
          }
          if (list.length > 50) console.log(`... (${list.length - 50} more)`);
        }
      } catch (_) {
        console.log('\n(pm2 jlist parse failed; skipping sanitized summary)');
      }
    }
  }

  printSection('/var/www Checks');
  for (const cmd of [
    'echo \"--- /var/www/fatopago listing (top 200) ---\"; ls -lah /var/www/fatopago 2>/dev/null | head -n 200 || true',
    'ls -ld /var/www /var/www/fatopago /var/www/fatopago/dist /var/www/fatopago/dist/assets 2>/dev/null || true',
    // World-writable files/dirs are a common local escalation vector.
    'echo \"--- world-writable under /var/www/fatopago (top 200) ---\"; find /var/www/fatopago -xdev \\( -type d -o -type f \\) -perm -0002 -print 2>/dev/null | head -n 200 || true',
    // Check for suspicious symlinks inside dist (can expose non-webroot files if misconfigured later).
    'echo \"--- symlinks under /var/www/fatopago/dist (top 200) ---\"; find /var/www/fatopago/dist -xdev -type l -ls 2>/dev/null | head -n 200 || true',
    // .env should not be world-readable.
    'echo \"--- env perms ---\"; stat -c \"%a %U:%G %n\" /var/www/fatopago/.env /var/www/fatopago/.env.production 2>/dev/null || true',
    // Backend presence (some deploy paths expect this).
    'echo \"--- server/index.js (if present) ---\"; stat -c \"%a %U:%G %n\" /var/www/fatopago/server/index.js 2>/dev/null || echo \"missing\"',
  ]) {
    const { out } = await run(cmd);
    if (out) console.log(out);
  }

  printSection('HTTP Self-Checks (local)');
  for (const cmd of [
    // Verify nothing sensitive is directly served from the docroot.
    'curl -sS -o /dev/null -w \"GET / => %{http_code}\\n\" http://127.0.0.1/ || true',
    'curl -sS -o /dev/null -w \"GET /.env (should be 404/403) => %{http_code}\\n\" http://127.0.0.1/.env || true',
    'curl -sS -o /dev/null -w \"GET /assets/ => %{http_code}\\n\" http://127.0.0.1/assets/ || true',
    // Host header checks to hit the intended vhost (more realistic than default server).
    'curl -sS -o /dev/null -w \"GET / (Host=fatopago.com) => %{http_code}\\n\" -H \"Host: fatopago.com\" http://127.0.0.1/ || true',
    'curl -sS -o /dev/null -w \"GET /api (Host=fatopago.com) => %{http_code}\\n\" -H \"Host: fatopago.com\" http://127.0.0.1/api || true',
    'curl -sS -o /dev/null -w \"GET / (Host=xn--fazservio-x3a.com.br) => %{http_code}\\n\" -H \"Host: xn--fazservio-x3a.com.br\" http://127.0.0.1/ || true',
    'curl -sS -o /dev/null -w \"GET /api/ (Host=xn--fazservio-x3a.com.br) => %{http_code}\\n\" -H \"Host: xn--fazservio-x3a.com.br\" http://127.0.0.1/api/ || true',
    // Direct backend check (should typically be loopback-only; currently at least one is 0.0.0.0:5000).
    'curl -sS -o /dev/null -w \"GET http://127.0.0.1:5000/ => %{http_code}\\n\" http://127.0.0.1:5000/ || true',
    'curl -sS -o /dev/null -w \"GET http://127.0.0.1:3000/ => %{http_code}\\n\" http://127.0.0.1:3000/ || true',
  ]) {
    const { out } = await run(cmd);
    if (out) console.log(out);
  }

  ssh.dispose();
}

main().catch((err) => {
  console.error('audit_vps_security failed:', err?.message || err);
  try { ssh.dispose(); } catch {}
  process.exit(1);
});
