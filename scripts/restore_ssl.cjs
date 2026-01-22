
const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

// VPS Credentials
const host = '72.60.53.191';
const username = 'root';
const password = 'Horapiaui@2026';

async function restoreSSL() {
    console.log(`Connecting to ${host}...`);
    try {
        await ssh.connect({
            host,
            username,
            password
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
