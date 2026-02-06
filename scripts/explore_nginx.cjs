
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

async function explore() {
    console.log(`Connecting to ${host}...`);
    try {
        await ssh.connect({
            host,
            username,
            port,
            ...(privateKey ? { privateKey } : { password })
        });
        console.log('Connected!');

        console.log('--- Nginx Dir Listing ---');
        const nginxDir = await ssh.execCommand('ls -F /etc/nginx/');
        console.log(nginxDir.stdout);

        console.log('--- Conf.d Listing ---');
        const confD = await ssh.execCommand('ls -F /etc/nginx/conf.d/');
        console.log(confD.stdout);

        console.log('\n--- Nginx Main Config ---');
        const config = await ssh.execCommand('cat /etc/nginx/nginx.conf');
        console.log(config.stdout);

        ssh.dispose();

    } catch (error) {
        console.error('Exploration Failed:', error);
        ssh.dispose();
    }
}

explore();
