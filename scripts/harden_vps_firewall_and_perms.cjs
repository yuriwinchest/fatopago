/*
  Step 2 + Step 4 hardening (VPS):
  - Enable a host firewall (firewalld) and allow only SSH/HTTP/HTTPS.
  - Remove world-writable permissions from web roots and env files.

  Notes:
  - This changes the VPS configuration.
  - It avoids printing secrets (no .env cat).
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
const sshPort = process.env.VPS_PORT ? Number(process.env.VPS_PORT) : 22;

const defaultKeyPath = path.join(os.homedir(), '.ssh', 'fatopago_key');
const privateKeyRaw = process.env.VPS_KEY_PATH || (fs.existsSync(defaultKeyPath) ? defaultKeyPath : undefined);
const privateKey =
  privateKeyRaw &&
  typeof privateKeyRaw === 'string' &&
  !privateKeyRaw.includes('BEGIN') &&
  fs.existsSync(privateKeyRaw)
    ? fs.readFileSync(privateKeyRaw, 'utf8')
    : privateKeyRaw;

if (!host) throw new Error('VPS_HOST environment variable is required');
if (!privateKey && !password) throw new Error('Defina VPS_KEY_PATH (recomendado) ou VPS_PASSWORD no ambiente.');

async function run(cmd, opts = {}) {
  const res = await ssh.execCommand(cmd, opts);
  const out = (res.stdout || '').trim();
  const err = (res.stderr || '').trim();
  return { code: res.code, out, err };
}

async function must(cmd, opts = {}) {
  const r = await run(cmd, opts);
  if (r.code !== 0) {
    const msg = `Command failed (${r.code}): ${cmd}\n${r.out}\n${r.err}`.trim();
    throw new Error(msg);
  }
  return r;
}

function section(title) {
  console.log(`\n=== ${title} ===`);
}

async function main() {
  await ssh.connect({
    host,
    username,
    port: sshPort,
    ...(privateKey ? { privateKey } : { password }),
    tryKeyboard: true,
    readyTimeout: 30000,
  });

  section('Precheck (ports)');
  {
    const r = await run('ss -tulpn 2>/dev/null | head -n 200 || true');
    console.log(r.out || r.err || '(no output)');
  }

  section('Firewall: install + enable firewalld');
  {
    // Install if missing.
    const has = await run('command -v firewall-cmd >/dev/null 2>&1; echo $?');
    if (has.out !== '0') {
      // AlmaLinux/RHEL: dnf.
      await must('dnf install -y firewalld');
    }
    await must('systemctl enable --now firewalld');
    await must('firewall-cmd --state');
  }

  section('Firewall: allow SSH/HTTP/HTTPS only (public zone)');
  {
    // Set default zone to public (idempotent).
    await must('firewall-cmd --set-default-zone=public');

    // Remove services we do not want exposed (common defaults on some VPS images).
    // Keep this conservative: we explicitly re-add ssh/http/https below.
    await run('firewall-cmd --permanent --zone=public --remove-service=cockpit || true');
    await run('firewall-cmd --permanent --zone=public --remove-service=dhcpv6-client || true');

    // Always allow ssh/http/https services.
    await must('firewall-cmd --permanent --zone=public --add-service=ssh');
    await must('firewall-cmd --permanent --zone=public --add-service=http');
    await must('firewall-cmd --permanent --zone=public --add-service=https');

    // If SSH is on a nonstandard port, explicitly allow it too.
    if (sshPort && Number.isFinite(sshPort) && sshPort !== 22) {
      await must(`firewall-cmd --permanent --zone=public --add-port=${sshPort}/tcp`);
    }

    // Do NOT open 5000/tcp or 111/tcp/udp. If previously opened, remove them.
    await run('firewall-cmd --permanent --zone=public --remove-port=5000/tcp || true');
    await run('firewall-cmd --permanent --zone=public --remove-port=111/tcp || true');
    await run('firewall-cmd --permanent --zone=public --remove-port=111/udp || true');

    await must('firewall-cmd --reload');
    const list = await must('firewall-cmd --zone=public --list-all');
    console.log(list.out);
  }

  section('Permissions: remove world-writable from web roots');
  {
    const cmds = [
      // FatoPago: dist should never be world-writable.
      'test -d /var/www/fatopago/dist && chmod -R u=rwX,go=rX -- /var/www/fatopago/dist || true',
      // Whole tree: remove "other" write bit if it exists anywhere.
      'test -d /var/www/fatopago && chmod -R o-w -- /var/www/fatopago || true',
      // Lock env.local (it is not supposed to be world-readable).
      'test -f /var/www/fatopago/.env.local && chmod 600 -- /var/www/fatopago/.env.local || true',
      'test -f /var/www/fatopago/.env && chmod 600 -- /var/www/fatopago/.env || true',
      'test -f /var/www/fatopago/.env.production && chmod 600 -- /var/www/fatopago/.env.production || true',

      // FazServico static root: ensure no world-writable.
      'test -d /var/www/fazservico && chmod -R o-w -- /var/www/fazservico || true',
      'test -d /var/www/fazservico && chmod -R u=rwX,go=rX -- /var/www/fazservico || true',

      // Servicoja uploads: do not allow world-writable.
      'test -d /opt/servicoja/backend/uploads && chmod -R o-w -- /opt/servicoja/backend/uploads || true',
      // Keep it readable (it is served publicly by the backend at /uploads).
      'test -d /opt/servicoja/backend/uploads && chmod -R u=rwX,go=rX -- /opt/servicoja/backend/uploads || true',
    ];

    for (const c of cmds) {
      const r = await run(c);
      if (r.code !== 0 && r.err) console.log(r.err);
    }

    // Show remaining world-writable findings (top 200) for operator review.
    const ww = await run('echo \"--- world-writable under /var/www (top 200) ---\"; find /var/www -xdev \\( -type d -o -type f \\) -perm -0002 -print 2>/dev/null | head -n 200 || true');
    console.log(ww.out || ww.err || '(no output)');
  }

  section('Postcheck: env perms + dist perms');
  {
    const r = await run('stat -c \"%a %U:%G %n\" /var/www/fatopago/.env.local /var/www/fatopago/.env /var/www/fatopago/.env.production 2>/dev/null || true');
    console.log(r.out || r.err || '(no output)');
    const r2 = await run('stat -c \"%a %U:%G %n\" /var/www/fatopago/dist /var/www/fatopago/dist/assets 2>/dev/null || true');
    console.log(r2.out || r2.err || '(no output)');
    const r3 = await run('stat -c \"%a %U:%G %n\" /var/www/fazservico /var/www/fazservico/assets 2>/dev/null || true');
    console.log(r3.out || r3.err || '(no output)');
  }

  ssh.dispose();
}

main().catch((err) => {
  console.error('harden_vps_firewall_and_perms failed:', err?.message || err);
  try { ssh.dispose(); } catch {}
  process.exit(1);
});
