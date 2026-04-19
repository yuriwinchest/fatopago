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

if (!host) throw new Error('Defina VPS_HOST no ambiente.');
if (!privateKey && !password) {
    throw new Error('Defina VPS_KEY_PATH (recomendado) ou tenha a chave padrão em ~/.ssh/fatopago_key. Em último caso, use VPS_PASSWORD.');
}

async function checkAssets() {
    await ssh.connect({
        host,
        username,
        port,
        ...(privateKey ? { privateKey } : { password }),
        tryKeyboard: true
    });

    const assets = await ssh.execCommand('ls -la /var/www/fatopago/assets | head -n 20');
    if (assets.stdout) console.log(assets.stdout);
    if (assets.stderr) console.error(assets.stderr);

    const index = await ssh.execCommand("grep -o 'assets/index-[^\"]*' /var/www/fatopago/index.html");
    if (index.stdout) console.log(index.stdout);
    if (index.stderr) console.error(index.stderr);

    ssh.dispose();
}

checkAssets().catch((error) => {
    console.error('Falha ao checar assets:', error);
    ssh.dispose();
    process.exit(1);
});
