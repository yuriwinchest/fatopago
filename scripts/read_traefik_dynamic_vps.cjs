/*
  Read Traefik file-provider dynamic configs from the VPS.

  This is a read-only inspection helper to understand how routes/services are wired
  (e.g., whether Traefik points to container names or host ports).

  It avoids printing any local .env contents; it only prints Traefik dynamic files.
*/

const path = require('path');
const fs = require('fs');
const os = require('os');
const { NodeSSH } = require('node-ssh');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

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

async function main() {
  console.log('Conectando na VPS...');
  await ssh.connect({
    host,
    username,
    port,
    ...(privateKey ? { privateKey } : { password }),
    tryKeyboard: true,
    readyTimeout: 30000,
    keepaliveInterval: 10000,
  });

  const cmd = [
    'set -euo pipefail',
    'DYN_DIR="/opt/traefik/dynamic.d"',
    'echo "== ls -lah $DYN_DIR =="',
    'ls -lah "$DYN_DIR" || true',
    'echo',
    'shopt -s nullglob',
    'files=("$DYN_DIR"/*.yml "$DYN_DIR"/*.yaml)',
    'echo "== dynamic files (${#files[@]}) =="',
    'for f in "${files[@]}"; do echo "$f"; done',
    'echo',
    'for f in "${files[@]}"; do',
    '  echo "===== $f ====="',
    '  # Print a reasonable chunk; dynamic files should be small.',
    '  sed -n "1,260p" "$f" || true',
    '  echo',
    'done',
  ].join('\n');

  // Use single-quoted bash -lc argument so the *outer* shell doesn't expand $VARS.
  const shSingleQuote = (s) => `'${String(s).replace(/'/g, `'\\\\''`)}'`;
  const r = await ssh.execCommand(`bash -lc ${shSingleQuote(cmd)}`);
  if (r.stdout) console.log(r.stdout.trimEnd());
  if (r.stderr) console.error(r.stderr.trimEnd());

  ssh.dispose();
}

main().catch((err) => {
  console.error('read_traefik_dynamic_vps failed:', err?.message || err);
  try { ssh.dispose(); } catch {}
  process.exit(1);
});
