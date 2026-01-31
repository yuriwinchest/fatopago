const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

const host = process.env.VPS_HOST;
const username = process.env.VPS_USER;
const password = process.env.VPS_PASSWORD;
const privateKey = process.env.VPS_KEY_PATH;
const port = process.env.VPS_PORT ? Number(process.env.VPS_PORT) : undefined;

if (!host || !username) throw new Error('Defina VPS_HOST e VPS_USER no ambiente.');
if (!privateKey && !password) throw new Error('Defina VPS_KEY_PATH (recomendado) ou VPS_PASSWORD no ambiente.');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl) throw new Error('Defina SUPABASE_URL (ou VITE_SUPABASE_URL) no ambiente.');
if (!serviceKey) throw new Error('Defina SUPABASE_SERVICE_ROLE_KEY no ambiente.');

async function main() {
  await ssh.connect({
    host,
    username,
    port,
    ...(privateKey ? { privateKey } : { password }),
    tryKeyboard: true,
  });

  const updateCmd = [
    `grep -q '^SUPABASE_URL=' /var/www/fatopago/.env && sed -i 's|^SUPABASE_URL=.*|SUPABASE_URL=${supabaseUrl}|' /var/www/fatopago/.env || echo 'SUPABASE_URL=${supabaseUrl}' >> /var/www/fatopago/.env`,
    `grep -q '^SUPABASE_SERVICE_ROLE_KEY=' /var/www/fatopago/.env && sed -i 's|^SUPABASE_SERVICE_ROLE_KEY=.*|SUPABASE_SERVICE_ROLE_KEY=${serviceKey}|' /var/www/fatopago/.env || echo 'SUPABASE_SERVICE_ROLE_KEY=${serviceKey}' >> /var/www/fatopago/.env`,
  ].join(' && ');

  const res = await ssh.execCommand(updateCmd);
  if (res.stderr) console.error(res.stderr);

  ssh.dispose();
}

main().catch((err) => {
  console.error('Falha ao atualizar .env da VPS:', err);
  try {
    ssh.dispose();
  } catch {}
  process.exit(1);
});
