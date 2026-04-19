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
        'docker restart app_01_fatopago',
        'sleep 2',
        'docker ps --filter name=app_01_fatopago --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"',
        'curl -sS -o /dev/null -w "http_local_4101:/=%{http_code}\\n" http://127.0.0.1:4101/ || true',
        'docker exec app_01_fatopago ls -lah /usr/share/nginx/html | head -n 20',
        'docker inspect app_01_fatopago --format "health={{.State.Health.Status}}"'
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
    console.error('Falha ao reiniciar container fatopago:', error);
    try {
        ssh.dispose();
    } catch (_) {}
    process.exit(1);
});

