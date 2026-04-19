/*
  Provision SSH key-based access for VPS deploy scripts.

  What it does:
  - Ensures a local SSH keypair exists (default: ~/.ssh/fatopago_key).
  - Installs the public key into ~/.ssh/authorized_keys on the VPS.
  - Verifies that a second connection works using ONLY the SSH key.

  Why:
  - Deploy scripts should not rely on storing VPS passwords in .env files.
  - After this works, remove VPS_PASSWORD from .env and (optionally) harden SSH auth on the VPS:
      node --env-file=.env scripts/harden_vps_ssh_auth.cjs
*/

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { NodeSSH } = require('node-ssh');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

function shSingleQuote(s) {
  // Safely wrap arbitrary text in single quotes for POSIX shells.
  // Inside a single-quoted string, the only character that needs special handling is a single quote itself.
  // We escape it by closing the quote, inserting a quoted single quote, and reopening:
  //   'foo'"'"'bar'
  return `'${String(s).replace(/'/g, `'\"'\"'`)}'`;
}

function resolveKeyPath() {
  const defaultKeyPath = path.join(os.homedir(), '.ssh', 'fatopago_key');
  const raw = process.env.VPS_KEY_PATH;

  // For provisioning we need a *path* (not inline key content).
  if (raw && typeof raw === 'string' && !raw.includes('BEGIN')) {
    return raw.endsWith('.pub') ? raw.slice(0, -4) : raw;
  }
  return defaultKeyPath;
}

function ensureLocalKeypair(keyPath) {
  const pubPath = `${keyPath}.pub`;

  fs.mkdirSync(path.dirname(keyPath), { recursive: true });

  const hasPriv = fs.existsSync(keyPath);
  const hasPub = fs.existsSync(pubPath);

  if (!hasPriv) {
    console.log(`Gerando chave SSH (ed25519) em: ${keyPath}`);
    try {
      execFileSync(
        'ssh-keygen',
        ['-t', 'ed25519', '-a', '64', '-f', keyPath, '-N', '', '-C', 'fatopago-deploy'],
        { stdio: 'inherit' }
      );
    } catch (err) {
      if (err && err.code === 'ENOENT') {
        throw new Error('ssh-keygen não encontrado. Instale/ative o OpenSSH no seu sistema e rode novamente.');
      }
      throw err;
    }
  } else if (!hasPub) {
    console.log(`Gerando chave pública a partir da privada: ${pubPath}`);
    let pub = '';
    try {
      pub = execFileSync('ssh-keygen', ['-y', '-f', keyPath], { encoding: 'utf8' }).trim();
    } catch (err) {
      if (err && err.code === 'ENOENT') {
        throw new Error(`Chave privada existe (${keyPath}), mas ssh-keygen não está disponível para gerar a pública.`);
      }
      throw err;
    }
    fs.writeFileSync(pubPath, `${pub}\n`, { encoding: 'utf8', mode: 0o644 });
  }

  const pubLine = fs.readFileSync(pubPath, 'utf8').trim();
  if (!pubLine || !pubLine.startsWith('ssh-')) {
    throw new Error(`Chave pública inválida em ${pubPath}`);
  }
  const parts = pubLine.split(/\s+/);
  if (parts.length < 2) throw new Error(`Chave pública inválida em ${pubPath}`);

  const privateKey = fs.readFileSync(keyPath, 'utf8');
  if (!privateKey.includes('BEGIN') && !privateKey.includes('OPENSSH PRIVATE KEY')) {
    // This is a heuristic; we just want to avoid passing garbage to ssh2.
    console.warn('[WARN] Conteúdo da chave privada parece fora do padrão OpenSSH.');
  }

  return { keyPath, pubPath, pubLine, privateKey };
}

async function tryConnect({ host, username, port, privateKey, password }) {
  const ssh = new NodeSSH();
  try {
    await ssh.connect({
      host,
      username,
      port,
      ...(privateKey ? { privateKey } : { password }),
      tryKeyboard: true,
      readyTimeout: 30000,
      keepaliveInterval: 10000,
    });
    return { ssh };
  } catch (err) {
    try {
      ssh.dispose();
    } catch {}
    throw err;
  }
}

async function main() {
  const host = process.env.VPS_HOST;
  const username = process.env.VPS_USER || 'root';
  const port = process.env.VPS_PORT ? Number(process.env.VPS_PORT) : undefined;
  const password = process.env.VPS_PASSWORD;

  if (!host) throw new Error('Defina VPS_HOST no ambiente.');

  const keyPath = resolveKeyPath();
  const { pubLine, privateKey } = ensureLocalKeypair(keyPath);

  console.log('\nConectando na VPS para instalar a chave (primeira vez pode precisar de senha)...');

  let ssh;
  try {
    // 1) Try key first (if it already works)
    try {
      ({ ssh } = await tryConnect({ host, username, port, privateKey }));
      console.log('Conectado usando chave SSH.');
    } catch (e) {
      if (!password) {
        throw new Error(
          'Conexão por chave falhou e VPS_PASSWORD não está definido. ' +
            'Defina VPS_PASSWORD apenas para este provisionamento (uma vez) e rode novamente.'
        );
      }
      ({ ssh } = await tryConnect({ host, username, port, password }));
      console.log('Conectado usando senha (apenas para instalar a chave).');
    }

    const installCmd =
      [
        'set -euo pipefail',
        'umask 077',
        'mkdir -p ~/.ssh',
        'chmod 700 ~/.ssh',
        'touch ~/.ssh/authorized_keys',
        'chmod 600 ~/.ssh/authorized_keys',
        '',
        // Keep the key material out of logs by deriving it on the server.
        'PUB_LINE="$(cat <<__FATOPAGO_PUB__',
        pubLine,
        '__FATOPAGO_PUB__',
        ')"',
        'KEY_MATERIAL="$(printf "%s\\n" "$PUB_LINE" | awk \'{print $2}\')"',
        '',
        'if grep -qF "$KEY_MATERIAL" ~/.ssh/authorized_keys; then',
        '  echo "authorized_keys: key_already_present=1"',
        'else',
        '  printf "%s\\n" "$PUB_LINE" >> ~/.ssh/authorized_keys',
        '  echo "authorized_keys: key_added=1"',
        'fi',
      ].join('\n') + '\n';

    const r = await ssh.execCommand(`bash -lc ${shSingleQuote(installCmd)}`);
    const out = (r.stdout || '').trim();
    if (out) console.log(out);
    if (r.code !== 0) {
      // Avoid printing stderr here because some shells echo parts of the command on error,
      // which could include the public key line.
      throw new Error(`Falha ao instalar chave (code ${r.code}).`);
    }
  } finally {
    if (ssh) ssh.dispose();
  }

  console.log('\nValidando: reconexão usando SOMENTE chave SSH...');
  let ssh2;
  try {
    ({ ssh: ssh2 } = await tryConnect({ host, username, port, privateKey }));
    const who = await ssh2.execCommand('whoami');
    const whoOut = (who.stdout || '').trim() || '(sem saída)';
    console.log(`OK: chave funcionando (whoami=${whoOut}).`);
  } finally {
    if (ssh2) ssh2.dispose();
  }

  console.log('\nPróximos passos (recomendado):');
  console.log('1) Remover VPS_PASSWORD do .env/.env.local (deixe só a chave).');
  console.log('2) Deploy normal: node --env-file=.env scripts/deploy_quick.cjs');
  console.log('3) (Opcional) Harden SSH na VPS: node --env-file=.env scripts/harden_vps_ssh_auth.cjs');
  console.log('\nObs: se você não definir VPS_KEY_PATH, os scripts usam o padrão: ~/.ssh/fatopago_key');
}

main().catch((err) => {
  console.error('provision_vps_ssh_key failed:', err?.message || err);
  process.exit(1);
});
