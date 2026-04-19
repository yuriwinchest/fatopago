const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
const fs = require('fs');
const os = require('os');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const host = process.env.VPS_HOST;
if (!host) throw new Error('VPS_HOST environment variable is required');
const username = process.env.VPS_USER || 'root';
const password = process.env.VPS_PASSWORD;
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

if (!host || !username) throw new Error('Defina VPS_HOST e VPS_USER no ambiente.');
if (!privateKey && !password) throw new Error('Defina VPS_KEY_PATH (recomendado) ou tenha a chave padrão em ~/.ssh/fatopago_key. Em último caso, use VPS_PASSWORD.');

const updates = {
  SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  VITE_STRIPE_PUBLIC_KEY: process.env.VITE_STRIPE_PUBLIC_KEY,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  VITE_API_URL: process.env.VITE_API_URL,
  PORT: process.env.PORT || '3000',
};

const entriesToUpdate = Object.entries(updates).filter(([, value]) => {
  if (typeof value !== 'string') return false;
  return value.trim().length > 0;
});

if (entriesToUpdate.length === 0) {
  throw new Error(
    'Defina pelo menos uma variável para atualizar: VITE_STRIPE_PUBLIC_KEY, STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_API_URL, PORT.'
  );
}

async function main() {
  await ssh.connect({
    host,
    username,
    port,
    ...(privateKey ? { privateKey } : { password }),
    tryKeyboard: true,
  });

  const exportPairs = entriesToUpdate
    .map(([key, value]) => {
      const b64 = Buffer.from(String(value), 'utf8').toString('base64');
      return `${key}_B64='${b64}'`;
    })
    .join(' ');

  const pyTemplate = (remoteEnvFile) => String.raw`import os
import base64
from pathlib import Path

env_path = Path(r"${remoteEnvFile}")
env_path.parent.mkdir(parents=True, exist_ok=True)

raw_lines = []
if env_path.exists():
    raw_lines = env_path.read_text(encoding="utf-8").splitlines()

updates = {}
for key in ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "VITE_STRIPE_PUBLIC_KEY", "STRIPE_SECRET_KEY", "VITE_API_URL", "PORT"]:
    b64 = os.environ.get(f"{key}_B64")
    if b64:
        updates[key] = base64.b64decode(b64.encode("utf-8")).decode("utf-8")

seen = set()
out = []
for line in raw_lines:
    if not line or line.lstrip().startswith("#") or "=" not in line:
        out.append(line)
        continue
    k, _v = line.split("=", 1)
    if k in updates:
        out.append(f"{k}={updates[k]}")
        seen.add(k)
    else:
        out.append(line)

for k, v in updates.items():
    if k not in seen:
        out.append(f"{k}={v}")

env_path.write_text("\n".join(out) + "\n", encoding="utf-8")
env_path.chmod(0o600)`;

  const remoteEnvFiles = ['/var/www/fatopago/.env', '/var/www/fatopago/.env.production'];

  for (const remoteEnvFile of remoteEnvFiles) {
    const py = pyTemplate(remoteEnvFile);
    const updateCmd = `${exportPairs} python3 - <<'PY'\n${py}\nPY`;
    const res = await ssh.execCommand(updateCmd);
    if (res.stderr) console.error(res.stderr);
  }

  ssh.dispose();
}

main().catch((err) => {
  console.error('Falha ao atualizar .env da VPS:', err);
  try {
    ssh.dispose();
  } catch { }
  process.exit(1);
});
