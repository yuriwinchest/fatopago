
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

async function checkFiles() {
    console.log(`Connecting to ${host}...`);
    try {
        await ssh.connect({
            host,
            username,
            port,
            ...(privateKey ? { privateKey } : { password })
        });
        console.log('Connected!');

        const filesToCheck = [
            '/var/www/fatopago/dist/logo.png',
            '/var/www/fatopago/dist/favicon.png',
            '/var/www/fatopago/dist/favicon.ico',
            '/var/www/fatopago/dist/site.webmanifest',
            '/var/www/fatopago/public/logo.png'
        ];

        for (const file of filesToCheck) {
            const result = await ssh.execCommand(`ls -l ${file}`);
            console.log(`${file}: ${result.stdout || result.stderr}`);
        }

        ssh.dispose();
    } catch (error) {
        console.error('Check failed:', error);
        ssh.dispose();
    }
}

checkFiles();
