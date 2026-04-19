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
        'docker ps --format "table {{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}"',
        'docker logs --tail 120 app_01_fatopago',
        'docker logs --tail 120 traefik'
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
    console.error('Falha ao checar docker logs:', error);
    try {
        ssh.dispose();
    } catch (_) {}
    process.exit(1);
});

