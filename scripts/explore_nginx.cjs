
const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

// VPS Credentials
const host = '72.60.53.191';
const username = 'root';
const password = 'Horapiaui@2026';

async function explore() {
    console.log(`Connecting to ${host}...`);
    try {
        await ssh.connect({
            host,
            username,
            password
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
