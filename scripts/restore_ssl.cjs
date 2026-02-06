
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

async function restoreSSL() {
    console.log(`Connecting to ${host}...`);
    try {
        await ssh.connect({
            host,
            username,
            port,
            ...(privateKey ? { privateKey } : { password })
        });
        console.log('Connected!');

        console.log('--- Running Certbot Installation ---');
        // Usando --reinstall para forçar a reconfiguração mesmo se ele achar que já existe
        // Usando --nginx para usar o plugin do nginx
        const result = await ssh.execCommand('certbot --nginx -d fatopago.com -d www.fatopago.com --reinstall --redirect --non-interactive --agree-tos -m admin@fatopago.com');
        console.log('STDOUT:', result.stdout);
        console.log('STDERR:', result.stderr);

        console.log('\n--- Restarting Nginx ---');
        await ssh.execCommand('systemctl restart nginx');
        console.log('Nginx restarted.');

        ssh.dispose();

    } catch (error) {
        console.error('SSL Restoration Failed:', error);
        ssh.dispose();
    }
}

restoreSSL();
