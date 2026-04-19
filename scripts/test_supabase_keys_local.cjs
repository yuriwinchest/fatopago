const fs = require('fs');
const path = require('path');

function parseDotEnv(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i === -1) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[k] = v;
  }
  return out;
}

function parseDashboardText(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    let m = line.match(/^Publishable key:\s*(\S+)/i);
    if (m) out.SB_PUBLISHABLE_KEY = m[1];
    m = line.match(/^Secret keys:\s*(\S+)/i);
    if (m) out.SB_SECRET_KEY = m[1];
    m = line.match(/^SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.+)$/i);
    if (m) out.SUPABASE_SERVICE_ROLE_KEY = m[1].trim().replace(/^['"]|['"]$/g, '');
    m = line.match(/^SUPABASE_URL\s*=\s*(.+)$/i);
    if (m) out.SUPABASE_URL = m[1].trim().replace(/^['"]|['"]$/g, '');
  }
  return out;
}

function redact(key) {
  if (!key) return null;
  const s = String(key);
  return { len: s.length, prefix: s.slice(0, Math.min(10, s.length)) };
}

async function healthCheck(supabaseUrl, label, key) {
  const url = supabaseUrl.replace(/\/$/, '');
  const res = await fetch(`${url}/auth/v1/health`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const text = await res.text();
  return { label, ok: res.ok, status: res.status, bodyPreview: text.slice(0, 120) };
}

async function main() {
  const env = parseDotEnv(path.join(process.cwd(), '.env'));
  const envLocal = parseDashboardText(path.join(process.cwd(), '.env.local'));

  const supabaseUrl = envLocal.SUPABASE_URL || env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  if (!supabaseUrl) throw new Error('Missing SUPABASE_URL/VITE_SUPABASE_URL');

  const viteAnon = env.VITE_SUPABASE_ANON_KEY;
  const publishable = envLocal.SB_PUBLISHABLE_KEY;
  const secret = envLocal.SB_SECRET_KEY;
  const serviceRole = envLocal.SUPABASE_SERVICE_ROLE_KEY;

  console.log(
    JSON.stringify(
      {
        supabaseUrl,
        vite_anon: redact(viteAnon),
        publishable: redact(publishable),
        secret: redact(secret),
        service_role: redact(serviceRole),
      },
      null,
      2,
    ),
  );

  const results = [];
  if (viteAnon) results.push(await healthCheck(supabaseUrl, 'vite_anon', viteAnon));
  if (publishable) results.push(await healthCheck(supabaseUrl, 'publishable', publishable));
  if (secret) results.push(await healthCheck(supabaseUrl, 'secret', secret));
  if (serviceRole) results.push(await healthCheck(supabaseUrl, 'service_role', serviceRole));

  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
