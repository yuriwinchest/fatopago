const { NodeSSH } = require('node-ssh');

const ssh = new NodeSSH();

const host = process.env.VPS_HOST;
const username = process.env.VPS_USER;
const password = process.env.VPS_PASSWORD;
const privateKey = process.env.VPS_KEY_PATH;
const port = process.env.VPS_PORT ? Number(process.env.VPS_PORT) : undefined;

if (!host || !username) {
    throw new Error('Defina VPS_HOST e VPS_USER no ambiente.');
}
if (!privateKey && !password) {
    throw new Error('Defina VPS_KEY_PATH (recomendado) ou VPS_PASSWORD no ambiente.');
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
