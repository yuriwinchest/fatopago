const fs = require('fs');
const crypto = require('crypto');

function parseDotEnv(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
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
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    let m = line.match(/^Publishable key:\s*(\S+)/i);
    if (m) out.publishable = m[1];
    m = line.match(/^Secret keys:\s*(\S+)/i);
    if (m) out.secret = m[1];
  }
  return out;
}

function sha12(s) {
  if (!s) return null;
  return crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 12);
}

const env = parseDotEnv('.env');
const dash = parseDashboardText('.env.local');

const vite = env.VITE_SUPABASE_ANON_KEY || '';
const pub = dash.publishable || '';
const sec = dash.secret || '';

console.log(
  JSON.stringify(
    {
      vite_len: vite.length,
      pub_len: pub.length,
      sec_len: sec.length,
      vite_eq_pub: vite === pub,
      vite_sha12: sha12(vite),
      pub_sha12: sha12(pub),
      sec_sha12: sha12(sec),
    },
    null,
    2,
  ),
);

