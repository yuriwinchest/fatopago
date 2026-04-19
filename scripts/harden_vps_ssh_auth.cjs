/*
  VPS SSH hardening (safe-ish):
  - Disable password auth
  - Permit root only with SSH keys (prohibit-password)
  - Ensure PubkeyAuthentication=yes
  - Disable keyboard-interactive / challenge-response auth
  - Ensure PermitEmptyPasswords=no
  - Validate config with `sshd -t` before reload
  - Reload sshd (does not usually drop existing connections)
  - Test a second SSH connection after reload
*/

const path = require('path');
const fs = require('fs');
const os = require('os');
const { NodeSSH } = require('node-ssh');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

function section(title) {
  console.log(`\n=== ${title} ===`);
}

function shSingleQuote(s) {
  return `'${String(s).replace(/'/g, `'\\\\''`)}'`;
}

async function connect() {
  const ssh = new NodeSSH();

  const host = process.env.VPS_HOST;
  if (!host) throw new Error('VPS_HOST environment variable is required');
  const username = process.env.VPS_USER || 'root';
  const password = process.env.VPS_PASSWORD;
  const port = process.env.VPS_PORT ? Number(process.env.VPS_PORT) : undefined;

  const defaultKeyPath = path.join(os.homedir(), '.ssh', 'fatopago_key');
  const privateKeyRaw = process.env.VPS_KEY_PATH || (fs.existsSync(defaultKeyPath) ? defaultKeyPath : undefined);
  const privateKey =
    privateKeyRaw &&
    typeof privateKeyRaw === 'string' &&
    !privateKeyRaw.includes('BEGIN') &&
    fs.existsSync(privateKeyRaw)
      ? fs.readFileSync(privateKeyRaw, 'utf8')
      : privateKeyRaw;

  if (!privateKey && !password) {
    throw new Error('Defina VPS_KEY_PATH (recomendado) ou VPS_PASSWORD no ambiente.');
  }

  await ssh.connect({
    host,
    username,
    port,
    ...(privateKey ? { privateKey } : { password }),
    tryKeyboard: true,
    readyTimeout: 30000,
    keepaliveInterval: 10000,
  });

  return { ssh, host, username, port, privateKey, password };
}

async function exec(ssh, cmd, opts = {}) {
  const r = await ssh.execCommand(cmd, opts);
  const out = (r.stdout || '').trimEnd();
  const err = (r.stderr || '').trimEnd();
  return { code: r.code, out, err };
}

async function must(ssh, cmd, opts = {}) {
  const r = await exec(ssh, cmd, opts);
  if (r.code !== 0) {
    throw new Error(`Command failed (${r.code}): ${cmd}\n${r.out}\n${r.err}`.trim());
  }
  return r;
}

async function main() {
  const { ssh } = await connect();

  try {
    section('Precheck: sshd effective config (sshd -T)');
    {
      const cmd = [
        'set -euo pipefail',
        'if command -v sshd >/dev/null 2>&1; then',
        '  sshd -T 2>/dev/null | egrep -i "^(permitrootlogin|passwordauthentication|pubkeyauthentication|permitemptypasswords|kbdinteractiveauthentication|challengeresponseauthentication)\\b" || true',
        'else',
        '  echo "sshd=missing"',
        'fi',
      ].join('\n');
      const r = await exec(ssh, `bash -lc ${shSingleQuote(cmd)}`);
      if (r.out) console.log(r.out);
      if (r.err) console.error(r.err);
    }

    section('Precheck: sshd_config lines (best effort)');
    {
      const cmd = [
        'set -euo pipefail',
        'CFG="/etc/ssh/sshd_config"',
        'echo "--- $CFG ---"',
        'grep -nE "^[[:space:]]*(Include|PermitRootLogin|PasswordAuthentication|PubkeyAuthentication|PermitEmptyPasswords|KbdInteractiveAuthentication|ChallengeResponseAuthentication|AllowUsers|AllowGroups)\\b" "$CFG" 2>/dev/null || echo "missing"',
        'echo',
        'if [ -d /etc/ssh/sshd_config.d ]; then',
        '  echo "--- /etc/ssh/sshd_config.d ---"',
        '  ls -lah /etc/ssh/sshd_config.d 2>/dev/null | head -n 200 || true',
        '  for f in /etc/ssh/sshd_config.d/*.conf; do',
        '    [ -f "$f" ] || continue',
        '    echo "----- $f -----"',
        '    grep -nE "^[[:space:]]*(PermitRootLogin|PasswordAuthentication|PubkeyAuthentication|PermitEmptyPasswords|KbdInteractiveAuthentication|ChallengeResponseAuthentication|AllowUsers|AllowGroups)\\b" "$f" 2>/dev/null || true',
        '  done',
        'fi',
      ].join('\n');
      const r = await exec(ssh, `bash -lc ${shSingleQuote(cmd)}`);
      if (r.out) console.log(r.out);
      if (r.err) console.error(r.err);
    }

    section('Apply: harden sshd_config (backup + edit + validate)');
    {
      const cmd = [
        'set -euo pipefail',
        'CFG="/etc/ssh/sshd_config"',
        'TS="$(date -u +%Y%m%d_%H%M%S)"',
        'cp -a "$CFG" "${CFG}.bak.${TS}"',
        // Build a block of missing directives to append once at the end.
        'NEED_APPEND=""',
        'replace_or_append(){',
        '  local k="$1" v="$2"',
        '  if grep -Eq "^[[:space:]]*${k}[[:space:]]+" "$CFG"; then',
        '    sed -i -E "s|^[[:space:]]*${k}[[:space:]]+.*|${k} ${v}|g" "$CFG"',
        '  else',
        '    NEED_APPEND="${NEED_APPEND}\\n${k} ${v}"',
        '  fi',
        '}',
        'replace_or_append PermitRootLogin "prohibit-password"',
        'replace_or_append PasswordAuthentication "no"',
        'replace_or_append PermitEmptyPasswords "no"',
        'replace_or_append PubkeyAuthentication "yes"',
        'replace_or_append KbdInteractiveAuthentication "no"',
        'replace_or_append ChallengeResponseAuthentication "no"',
        '',
        'if [ -n "${NEED_APPEND:-}" ]; then',
        '  printf "\\n# --- hardening (added %s UTC) ---\\n" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$CFG"',
        '  printf "%b\\n" "$NEED_APPEND" | sed "/^$/d" >> "$CFG"',
        'fi',
        '',
        // Validate config before touching the running daemon
        'sshd -t -f "$CFG"',
        'echo "sshd_config_ok=1"',
        'echo "backup=${CFG}.bak.${TS}"',
      ].join('\n');

      const r = await must(ssh, `bash -lc ${shSingleQuote(cmd)}`);
      if (r.out) console.log(r.out);
      if (r.err) console.error(r.err);
    }

    section('Reload SSH daemon');
    {
      const cmd = [
        'set -euo pipefail',
        // Use whichever service exists; reload preferred.
        'if command -v systemctl >/dev/null 2>&1; then',
        '  if systemctl list-unit-files | grep -q "^sshd\\.service"; then',
        '    systemctl reload sshd',
        '  elif systemctl list-unit-files | grep -q "^ssh\\.service"; then',
        '    systemctl reload ssh',
        '  else',
        '    echo "ssh_service_unknown=1"',
        '  fi',
        'else',
        '  echo "systemctl=missing"',
        'fi',
      ].join('\n');
      const r = await exec(ssh, `bash -lc ${shSingleQuote(cmd)}`);
      if (r.out) console.log(r.out);
      if (r.err) console.error(r.err);
    }

    section('Postcheck: sshd effective config (sshd -T)');
    {
      const cmd = [
        'set -euo pipefail',
        'sshd -T 2>/dev/null | egrep -i "^(permitrootlogin|passwordauthentication|pubkeyauthentication|permitemptypasswords|kbdinteractiveauthentication|challengeresponseauthentication)\\b" || true',
      ].join('\n');
      const r = await exec(ssh, `bash -lc ${shSingleQuote(cmd)}`);
      if (r.out) console.log(r.out);
      if (r.err) console.error(r.err);
    }

    section('Verify: second SSH connection after reload');
    {
      // Attempt to connect again using the same credentials.
      const { ssh: ssh2 } = await connect();
      try {
        const r = await exec(ssh2, 'whoami');
        console.log(`second_connect_whoami=${(r.out || '').trim() || '(no output)'}`);
      } finally {
        ssh2.dispose();
      }
      console.log('second_connect_ok=1');
    }
  } finally {
    ssh.dispose();
  }
}

main().catch((err) => {
  console.error('harden_vps_ssh_auth failed:', err?.message || err);
  process.exit(1);
});

