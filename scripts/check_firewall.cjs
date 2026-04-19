
const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
const fs = require('fs');
const os = require('os');
const path = require('path');

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

if (!host) {
    throw new Error('Defina VPS_HOST no ambiente.');
}
if (!privateKey && !password) {
    throw new Error('Defina VPS_KEY_PATH (recomendado) ou tenha a chave padrão em ~/.ssh/fatopago_key. Em último caso, use VPS_PASSWORD.');
}

async function checkFirewall() {
    console.log(`Connecting to ${host}...`);
    try {
        await ssh.connect({
            host,
            username,
            port,
            ...(privateKey ? { privateKey } : { password })
        });

        console.log('--- Firewalld Status ---');
        try {
            const firewalld = await ssh.execCommand('firewall-cmd --list-all');
            console.log(firewalld.stdout || 'Not output');
        } catch (e) { console.log('Firewalld error or not installed'); }

        ssh.dispose();

    } catch (error) {
        console.error('Check Failed:', error);
        ssh.dispose();
    }
}

checkFirewall();
