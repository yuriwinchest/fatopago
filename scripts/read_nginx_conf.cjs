
const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

// VPS Credentials
const host = '72.60.53.191';
const username = 'root';
const password = 'Horapiaui@2026';

async function readConfig() {
    console.log(`Connecting to ${host}...`);
    try {
        await ssh.connect({
            host,
            username,
            password
        });
        console.log('Connected!');

        console.log('\n--- Reading fatopago.com.conf ---');
        const config = await ssh.execCommand('cat /etc/nginx/conf.d/fatopago.com.conf');
        console.log(config.stdout);

        ssh.dispose();

    } catch (error) {
        console.error('Reading Config Failed:', error);
        ssh.dispose();
    }
}

readConfig();
