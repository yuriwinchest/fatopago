
const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

const host = '72.60.53.191';
const username = 'root';
const password = 'Horapiaui@2026';

async function checkFiles() {
    console.log(`Connecting to ${host}...`);
    try {
        await ssh.connect({ host, username, password });
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
