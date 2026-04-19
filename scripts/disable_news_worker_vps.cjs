// [2026-04-15] Desativa a ingestao externa de noticias no VPS.
//
// Fluxo:
//   1) Atualiza o arquivo scripts/news_ingest.cjs no VPS (nova versao com kill switch).
//   2) Garante ENABLE_EXTERNAL_INGESTION=false no .env do worker (defesa em camadas).
//   3) pm2 stop fatopago-news      → para o loop imediatamente.
//   4) pm2 save                    → persiste o estado parado contra reboot.
//
// Reversao manual (se quiser religar): SSH no VPS, editar {workerDir}/.env para
// ENABLE_EXTERNAL_INGESTION=true, e rodar `pm2 restart fatopago-news --update-env`.

const { NodeSSH } = require('node-ssh');
const path = require('path');
const fs = require('fs');
const os = require('os');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const ssh = new NodeSSH();

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

if (!privateKey && !password) throw new Error('Defina VPS_KEY_PATH (recomendado) ou VPS_PASSWORD no ambiente.');

const workerDir = process.env.VPS_NEWS_WORKER_DIR || '/var/www/fatopago-worker';
const localIngest = path.join(__dirname, 'news_ingest.cjs');

async function run(cmd, label) {
  console.log(`> ${label}`);
  const res = await ssh.execCommand(cmd, { execOptions: { pty: true } });
  if (res.stdout) process.stdout.write(res.stdout);
  if (res.stderr) process.stderr.write(res.stderr);
  return res;
}

async function main() {
  await ssh.connect({
    host,
    username,
    port,
    ...(privateKey ? { privateKey } : { password }),
    tryKeyboard: true,
    readyTimeout: 30000,
    keepaliveInterval: 10000,
  });

  console.log(`Conectado em ${host}.`);

  // 1) Sobe o news_ingest.cjs atualizado (com kill switch).
  await ssh.execCommand(`mkdir -p ${workerDir}/scripts`);
  await ssh.putFile(localIngest, `${workerDir}/scripts/news_ingest.cjs`);
  console.log(`news_ingest.cjs atualizado em ${workerDir}/scripts/`);

  // 2) Garante ENABLE_EXTERNAL_INGESTION=false no .env (idempotente).
  const ensureEnv =
    `touch ${workerDir}/.env && ` +
    `grep -q '^ENABLE_EXTERNAL_INGESTION=' ${workerDir}/.env ` +
    `  && sed -i 's/^ENABLE_EXTERNAL_INGESTION=.*/ENABLE_EXTERNAL_INGESTION=false/' ${workerDir}/.env ` +
    `  || echo 'ENABLE_EXTERNAL_INGESTION=false' >> ${workerDir}/.env`;
  await run(ensureEnv, 'garantindo ENABLE_EXTERNAL_INGESTION=false no .env');

  // 3) pm2 stop fatopago-news (se nao existir, ignora).
  await run(
    `bash -lc 'pm2 stop fatopago-news || true; pm2 save || true; pm2 list'`,
    'parando processo pm2 fatopago-news',
  );

  // 4) Confirma status.
  await run(
    `bash -lc "pm2 describe fatopago-news | grep -E 'status|name' || echo 'sem processo fatopago-news'"`,
    'status final',
  );

  console.log('\nOK. Ingestao externa desativada no VPS.');
  ssh.dispose();
}

main().catch((err) => {
  console.error('Falha ao desativar worker:', err?.message || err);
  try { ssh.dispose(); } catch {}
  process.exit(1);
});
