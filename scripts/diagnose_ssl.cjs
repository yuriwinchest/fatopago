
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

async function diagnose() {
    console.log(`Connecting to ${host}...`);
    try {
        await ssh.connect({
            host,
            username,
            port,
            ...(privateKey ? { privateKey } : { password })
        });
        console.log('Connected!');

        console.log('--- Nginx Sites Enabled ---');
        const sites = await ssh.execCommand('ls -l /etc/nginx/sites-enabled/');
        console.log(sites.stdout);
        console.log(sites.stderr);

        // Assuming 'fatopago' or 'default' is the site
        const siteName = sites.stdout.includes('fatopago') ? 'fatopago' : 'default';
        console.log(`\n--- Reading Config for ${siteName} ---`);
        const config = await ssh.execCommand(`cat /etc/nginx/sites-enabled/${siteName}`);
        console.log(config.stdout);

        console.log('\n--- Checking Certbot ---');
        const certbot = await ssh.execCommand('certbot certificates');
        console.log(certbot.stdout);
        console.log(certbot.stderr);

        ssh.dispose();

    } catch (error) {
        console.error('Diagnosis Failed:', error);
        ssh.dispose();
    }
}

diagnose();
