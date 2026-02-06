
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

async function checkOS() {
    console.log(`Connecting to ${host}...`);
    try {
        await ssh.connect({
            host,
            username,
            port,
            ...(privateKey ? { privateKey } : { password }),
            tryKeyboard: true,
        });
        console.log('Connected!');

        console.log('Checking OS Info...');
        const result = await ssh.execCommand('cat /etc/os-release; uname -a');
        console.log('OS INFO:\n', result.stdout);

        // Also check if yum or dnf exists
        const checkPkgManager = await ssh.execCommand('which apt-get; which yum; which dnf; which apk');
        console.log('Package Managers:\n', checkPkgManager.stdout);

        ssh.dispose();

    } catch (error) {
        console.error('Connection Failed:', error);
        ssh.dispose();
    }
}

checkOS();
