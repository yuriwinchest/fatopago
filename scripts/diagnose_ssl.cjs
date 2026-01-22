
const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

// VPS Credentials
const host = '72.60.53.191';
const username = 'root';
const password = 'Horapiaui@2026';

async function diagnose() {
    console.log(`Connecting to ${host}...`);
    try {
        await ssh.connect({
            host,
            username,
            password
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
