/*
  Run the read-only VPS security report script on the VPS and save output to a file.

  - Uploads: ./check_vps_security.sh -> /root/check_vps_security.sh
  - Executes: bash /root/check_vps_security.sh | tee /root/vps_security_report.txt
  - Prints: only a short summary section (to avoid dumping full logs in CI/console)
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

async function mustExec(cmd, opts = {}) {
  const r = await ssh.execCommand(cmd, opts);
  if (r.code !== 0) {
    const out = (r.stdout || '').trim();
    const err = (r.stderr || '').trim();
    throw new Error(`Command failed (${r.code}): ${cmd}\n${out}\n${err}`.trim());
  }
  return r;
}

async function main() {
  const localScript = path.join(__dirname, '../check_vps_security.sh');
  if (!fs.existsSync(localScript)) {
    throw new Error(`Arquivo local nao encontrado: ${localScript}`);
  }

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

  const remoteScript = '/root/check_vps_security.sh';
  const remoteReport = '/root/vps_security_report.txt';

  console.log('Enviando script para a VPS...');
  await ssh.putFile(localScript, remoteScript);

  console.log('Executando relatorio (pode levar alguns segundos)...');
  await mustExec(`chmod 700 ${remoteScript}`);
  // Keep stdout quiet here; the report can include logs. We store everything on the VPS.
  await mustExec(`bash ${remoteScript} | tee ${remoteReport} >/dev/null`);

  console.log('Relatorio salvo em:', remoteReport);

  // Print only the final summary section (avoid dumping full logs).
  const summaryCmd =
    `echo "===== SUMMARY (11) ====="; ` +
    `awk 'BEGIN{p=0} /11\\) RESUMO FINAL/{p=1} p{print}' ${remoteReport} | head -n 200; ` +
    `echo; echo "===== FILE ====="; ls -lah ${remoteReport} || true`;

  const s = await ssh.execCommand(`bash -lc ${JSON.stringify(summaryCmd)}`);
  if (s.stdout) console.log(s.stdout.trimEnd());
  if (s.stderr) console.error(s.stderr.trimEnd());

  ssh.dispose();
}

main().catch((err) => {
  console.error('run_vps_security_report failed:', err?.message || err);
  try { ssh.dispose(); } catch {}
  process.exit(1);
});
