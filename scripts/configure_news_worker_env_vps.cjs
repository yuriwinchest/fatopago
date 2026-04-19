const { NodeSSH } = require('node-ssh');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
const os = require('os');

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

if (!privateKey && !password) {
  throw new Error('Defina VPS_KEY_PATH (recomendado) ou VPS_PASSWORD no ambiente.');
}

// We intentionally DO NOT read these from repo files. This avoids storing secrets in git.
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function tryParseServiceRoleFromEnvLocal() {
  try {
    const envLocalPath = path.join(__dirname, '../.env.local');
    if (!fs.existsSync(envLocalPath)) return null;
    const content = fs.readFileSync(envLocalPath, 'utf8');

    // Support non-dotenv format commonly pasted from the Supabase dashboard:
    // "Secret keys: sb_secret_..."
    for (const raw of content.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      const m = line.match(/^Secret keys:\s*(\S+)\s*$/i);
      if (m && m[1]) return m[1].trim();
    }
  } catch {
    // ignore
  }
  return null;
}

if (!supabaseUrl) throw new Error('Defina SUPABASE_URL (ou VITE_SUPABASE_URL) no ambiente.');
if (!serviceRoleKey) serviceRoleKey = tryParseServiceRoleFromEnvLocal() || undefined;
if (!serviceRoleKey) throw new Error('Defina SUPABASE_SERVICE_ROLE_KEY no ambiente (ou em .env.local como "Secret keys: ...").');

const workerDir = process.env.VPS_NEWS_WORKER_DIR || '/var/www/fatopago-worker';

async function validateServiceRoleKey() {
  // Validate locally before touching the VPS (prevents shipping a wrong secret).
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (error) {
    throw new Error(
      `SUPABASE_SERVICE_ROLE_KEY invalida para este SUPABASE_URL (${supabaseUrl}). ` +
        `Erro: ${error.message}`,
    );
  }
}

function writeTempEnvFile(contents) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fatopago-worker-env-'));
  const filePath = path.join(dir, 'worker.env');
  fs.writeFileSync(filePath, contents, { encoding: 'utf8', mode: 0o600 });
  return { dir, filePath };
}

async function main() {
  await validateServiceRoleKey();

  const ssh = new NodeSSH();
  await ssh.connect({
    host,
    username,
    port,
    ...(privateKey ? { privateKey } : { password }),
    tryKeyboard: true,
    readyTimeout: 30000,
    keepaliveInterval: 10000,
  });

  await ssh.execCommand(`mkdir -p ${workerDir}`);

  const remoteEnvPath = `${workerDir}/.env`;
  // [2026-04-15] Valores recalibrados:
  //  - NEWS_PER_FEED_LIMIT (nome legado) agora e o TETO GLOBAL de insercoes por tick.
  //    Era 8 (absurdamente baixo). Subiu para 300 como safety cap.
  //  - RSS_SCAN_PER_FEED: quantos itens de cada feed olhar. Era 4 (perdia o grosso).
  //    Subiu para 20 - cobre a janela de publicacao recente dos grandes veiculos.
  //  - RSS_PER_FEED_INSERT_LIMIT (novo): cap de insercoes POR feed, para fair share.
  //    Sem isso os 7+ feeds da G1 starvavam CNN/UOL/Jovem Pan.
  //  - NEWS_RECENT_WINDOW: elevado para 3000 para reduzir chance de duplicatas em cenario
  //    de ~240 insercoes teoricas por tick x 20 ticks/hora.
  const envContents =
    `SUPABASE_URL=${JSON.stringify(supabaseUrl)}\n` +
    `SUPABASE_SERVICE_ROLE_KEY=${JSON.stringify(serviceRoleKey)}\n` +
    `TZ=America/Sao_Paulo\n` +
    `NEWS_POLL_INTERVAL_MS=180000\n` +
    `NEWS_PER_FEED_LIMIT=300\n` +
    `MEIO_NEWS_PRIORITY_COUNT=10\n` +
    `ENABLE_RSS_FEEDS=true\n` +
    `RSS_SCAN_PER_FEED=20\n` +
    `RSS_PER_FEED_INSERT_LIMIT=8\n` +
    `NEWS_RECENT_WINDOW=3000\n` +
    `NEWS_RETENTION_DAYS=2\n` +
    `NEWS_RETENTION_RUN_INTERVAL_MS=172800000\n`;

  const tmp = writeTempEnvFile(envContents);
  try {
    await ssh.putFile(tmp.filePath, remoteEnvPath);
  } finally {
    try { fs.rmSync(tmp.dir, { recursive: true, force: true }); } catch {}
  }

  // Lock down permissions on the VPS.
  await ssh.execCommand(`chown root:root ${remoteEnvPath} && chmod 600 ${remoteEnvPath}`);

  console.log('Env do worker configurado com permissao 600 (root:root).');
  ssh.dispose();
}

main().catch((err) => {
  console.error('Falha ao configurar env do worker:', err);
  process.exitCode = 1;
});
