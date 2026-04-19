/*
  Audit: upload/file validation on the VPS.

  This script is read-only: it just inspects code/config and prints grep hits.
  It avoids printing secrets (no .env cat, no env dumps).
*/

const path = require('path');
const fs = require('fs');
const os = require('os');
const { NodeSSH } = require('node-ssh');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const ssh = new NodeSSH();

const host = process.env.VPS_HOST;
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

if (!host) throw new Error('VPS_HOST environment variable is required');
if (!privateKey && !password) throw new Error('Defina VPS_KEY_PATH (recomendado) ou VPS_PASSWORD no ambiente.');

async function run(cmd, opts = {}) {
  const res = await ssh.execCommand(cmd, opts);
  const out = (res.stdout || '').trim();
  const err = (res.stderr || '').trim();
  return { code: res.code, out, err };
}

function section(title) {
  console.log(`\n=== ${title} ===`);
}

async function tryPrint(cmd) {
  const { out, err } = await run(cmd);
  if (out) console.log(out);
  else if (err) console.log(err);
}

async function main() {
  await ssh.connect({
    host,
    username,
    port,
    ...(privateKey ? { privateKey } : { password }),
    tryKeyboard: true,
    readyTimeout: 30000,
  });

  section('Nginx Upload-Related Directives');
  await tryPrint('echo \"--- client_max_body_size ---\"; grep -RIn --line-number \"client_max_body_size\" /etc/nginx/nginx.conf /etc/nginx/conf.d 2>/dev/null | head -n 200 || true');
  await tryPrint('echo \"--- limit_except ---\"; grep -RIn --line-number \"limit_except\" /etc/nginx/nginx.conf /etc/nginx/conf.d 2>/dev/null | head -n 200 || true');
  await tryPrint('echo \"--- add_header (security headers?) ---\"; grep -RIn --line-number \"add_header\" /etc/nginx/nginx.conf /etc/nginx/conf.d 2>/dev/null | head -n 200 || true');

  section('PM2 Processes (exec paths)');
  {
    const { out } = await run('pm2 jlist 2>/dev/null || true');
    if (!out) {
      console.log('pm2 jlist empty/unavailable');
    } else {
      try {
        const data = JSON.parse(out);
        for (const p of data) {
          const env = p?.pm2_env || {};
          console.log(`name=${p?.name} pid=${p?.pid} exec=${env?.pm_exec_path} cwd=${env?.pm_cwd}`);
        }
      } catch (e) {
        console.log('pm2 jlist parse failed:', e?.message || e);
      }
    }
  }

  // Focus paths we already know (servicoja backend + any /var/www/* server code).
  const candidateRoots = [
    '/opt/servicoja/backend',
    '/var/www/fatopago',
    '/var/www/fazservico',
    '/var/www/horapiaui',
  ];

  section('Candidate App Roots Presence');
  for (const r of candidateRoots) {
    await tryPrint(`echo \"--- ${r} ---\"; ls -ld ${r} 2>/dev/null || echo \"missing\"`);
  }

  section('Search: Upload Libraries & MIME Validation (excluding node_modules)');
  const patterns = [
    'multer',
    'busboy',
    'formidable',
    'express-fileupload',
    'fastify-multipart',
    'multipart/form-data',
    'FileInterceptor',
    'sharp',
    'jimp',
    'gm\\b',
    'imagemagick',
    'file-type',
    'mmmagic',
    'magic\\b',
    'mime-types',
    'content-type',
    'req\\.file',
    'req\\.files',
    'mimetype',
    'Content-Type',
    'svg',
    'image/svg\\+xml',
    'xml',
    'DOCTYPE',
    '<svg',
    'xlink:href',
    'onload=',
    '<script',
    'uploads?',
    'public/',
    'static',
  ];

  const grepRe = patterns.join('\\|');
  for (const r of candidateRoots) {
    await tryPrint(
      `echo \"--- root=${r} ---\"; ` +
      `test -d ${r} && ` +
      `grep -RIn --line-number --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git --exclude=package-lock.json --exclude=yarn.lock --exclude=pnpm-lock.yaml ` +
      `"${grepRe}" ${r} 2>/dev/null | head -n 200 || true`
    );
  }

  section('Inspect servicoja-backend package.json (deps only, if present)');
  await tryPrint('test -f /opt/servicoja/backend/package.json && (echo \"--- interesting deps (grep) ---\"; grep -n \"\\\"multer\\\"\\|\\\"busboy\\\"\\|\\\"formidable\\\"\\|\\\"express-fileupload\\\"\\|\\\"file-type\\\"\\|\\\"mime\\\"\\|\\\"sharp\\\"\\|\\\"jimp\\\"\\|\\\"gm\\\"\\|\\\"svg\\\"\\|\\\"xml\\\"\" /opt/servicoja/backend/package.json | head -n 200) || echo \"missing\"');

  section('servicoja-backend Upload Middleware (multer)');
  await tryPrint('echo \"--- upload.middleware.ts ---\"; sed -n \"1,240p\" /opt/servicoja/backend/src/shared/middleware/upload.middleware.ts 2>/dev/null || echo \"missing\"');
  await tryPrint('echo \"--- unifiedConfig.ts (uploads config) ---\"; sed -n \"1,120p\" /opt/servicoja/backend/src/config/unifiedConfig.ts 2>/dev/null || echo \"missing\"');
  await tryPrint('echo \"--- users.controller.ts (upload-related) ---\"; sed -n \"1,140p\" /opt/servicoja/backend/src/modules/users/users.controller.ts 2>/dev/null || echo \"missing\"');
  await tryPrint('echo \"--- users.routes.ts ---\"; sed -n \"1,200p\" /opt/servicoja/backend/src/modules/users/users.routes.ts 2>/dev/null || echo \"missing\"');
  await tryPrint('echo \"--- list users module files ---\"; ls -lah /opt/servicoja/backend/src/modules/users 2>/dev/null || true');
  await tryPrint('echo \"--- grep allowedMimeTypes usage ---\"; grep -RIn --line-number \"allowedMimeTypes\\|allowedExtensions\\|uploads\\.\" /opt/servicoja/backend/src 2>/dev/null | head -n 200 || true');
  await tryPrint('echo \"--- grep multer usage (routes/controllers) ---\"; grep -RIn --line-number \"upload\\.(single|array|fields)\\(\" /opt/servicoja/backend/src/modules 2>/dev/null | head -n 200 || true');
  await tryPrint('echo \"--- grep upload middleware imports ---\"; grep -RIn --line-number \"upload\\.middleware\" /opt/servicoja/backend/src 2>/dev/null | head -n 200 || true');
  await tryPrint('echo \"--- server.ts (uploads static + headers) ---\"; sed -n \"1,220p\" /opt/servicoja/backend/src/server.ts 2>/dev/null || echo \"missing\"');

  section('Runtime (dist/) Reality Check');
  await tryPrint('echo \"--- dist/server.js (uploads-related grep) ---\"; grep -n \"uploads\\|express\\.static\\|Content-Security-Policy\\|contentSecurityPolicy\\|helmet\\(\" /opt/servicoja/backend/dist/server.js 2>/dev/null | head -n 200 || true');
  await tryPrint('echo \"--- dist upload middleware ---\"; sed -n \"1,200p\" /opt/servicoja/backend/dist/shared/middleware/upload.middleware.js 2>/dev/null || echo \"missing\"');
  await tryPrint('echo \"--- dist image sniff ---\"; sed -n \"1,220p\" /opt/servicoja/backend/dist/shared/uploads/imageSniff.js 2>/dev/null || echo \"missing\"');
  await tryPrint('echo \"--- dist unifiedConfig ---\"; sed -n \"1,120p\" /opt/servicoja/backend/dist/config/unifiedConfig.js 2>/dev/null || echo \"missing\"');
  await tryPrint('echo \"--- dist users.routes ---\"; sed -n \"1,180p\" /opt/servicoja/backend/dist/modules/users/users.routes.js 2>/dev/null || echo \"missing\"');

  section('Locate Upload Directories');
  // Common patterns: /uploads, /tmp, /var/www/*/uploads, etc.
  await tryPrint('for base in /opt/servicoja/backend /var/www/fazservico /var/www/fatopago; do echo \"--- $base ---\"; test -d \"$base\" || { echo missing; continue; }; find \"$base\" -maxdepth 3 -type d \\( -iname upload -o -iname uploads -o -iname tmp -o -iname temp -o -iname files \\) -print 2>/dev/null | head -n 200; done');

  section('Routing Check: /uploads via Nginx vs Direct Backend');
  await tryPrint('echo \"--- nginx (Host=xn--fazservio-x3a.com.br) ---\"; curl -sS -o /dev/null -w \"http /uploads => %{http_code} redirect=%{redirect_url}\\n\" -I -H \"Host: xn--fazservio-x3a.com.br\" http://127.0.0.1/uploads/does-not-exist || true');
  await tryPrint('echo \"--- backend :5000 ---\"; curl -sS -o /dev/null -w \"http://127.0.0.1:5000 /uploads => %{http_code}\\n\" -I http://127.0.0.1:5000/uploads/does-not-exist || true');
  await tryPrint('echo \"--- backend :5000 headers (health) ---\"; curl -sSI http://127.0.0.1:5000/health 2>/dev/null | head -n 40 || true');
  await tryPrint('echo \"--- backend :5000 headers (uploads sample) ---\"; f=$(find /opt/servicoja/backend/uploads -maxdepth 1 -type f 2>/dev/null | head -n 1); if [ -n \"$f\" ]; then bn=$(basename \"$f\"); echo \"file=$bn\"; curl -sSI \"http://127.0.0.1:5000/uploads/$bn\" 2>/dev/null | head -n 60; else echo \"no-upload-files\"; fi');
  await tryPrint('echo \"--- /var/www/fazservico (uploads?) ---\"; ls -lah /var/www/fazservico 2>/dev/null | head -n 80 || true; find /var/www/fazservico -maxdepth 2 -type l -o -type d -name uploads 2>/dev/null | head -n 80 || true');

  ssh.dispose();
}

main().catch((err) => {
  console.error('audit_vps_upload_validation failed:', err?.message || err);
  try { ssh.dispose(); } catch {}
  process.exit(1);
});
