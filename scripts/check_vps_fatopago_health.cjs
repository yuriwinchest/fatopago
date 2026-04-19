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

async function run() {
    console.log('Conectando na VPS...');
    await ssh.connect({
        host,
        username,
        port,
        ...(privateKey ? { privateKey } : { password }),
        tryKeyboard: true,
        readyTimeout: 30000,
        keepaliveInterval: 10000
    });

    const cmds = [
        'ls -lah /var/www/fatopago/dist | head -n 50',
        'test -f /var/www/fatopago/dist/index.html && echo "dist:index.html=present" || echo "dist:index.html=MISSING"',
        'stat -c "%a %U:%G %n" /var/www/fatopago/dist 2>/dev/null || true',
        'stat -c "%a %U:%G %n" /var/www/fatopago/dist/index.html 2>/dev/null || true',
        'curl -sS -o /dev/null -w "http_local_4101:/=%{http_code}\\n" http://127.0.0.1:4101/ || true',
        'curl -sS -o /dev/null -w "http_local_4101:/index.html=%{http_code}\\n" http://127.0.0.1:4101/index.html || true',
        'docker inspect app_01_fatopago --format "{{json .Mounts}}"',
        'docker inspect app_01_fatopago --format "health={{.State.Health.Status}}"',
        'docker inspect app_01_fatopago --format "{{json .State.Health.Log}}" | tail -c 2500',
        'docker exec app_01_fatopago ls -lah /usr/share/nginx/html | head -n 30',
        'docker exec app_01_fatopago sh -lc "ls -lah /etc/nginx/conf.d && echo && cat /etc/nginx/conf.d/default.conf 2>/dev/null | sed -n \\"1,200p\\""',
    ];

    for (const cmd of cmds) {
        console.log(`\n===== ${cmd} =====`);
        const r = await ssh.execCommand(cmd);
        if (r.stdout) console.log(r.stdout.trimEnd());
        if (r.stderr) console.error(r.stderr.trimEnd());
    }

    ssh.dispose();
}

run().catch((error) => {
    console.error('Falha ao checar health do fatopago:', error);
    try {
        ssh.dispose();
    } catch (_) {}
    process.exit(1);
});
