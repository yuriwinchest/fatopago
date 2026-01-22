
const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

// VPS Credentials
const host = '72.60.53.191';
const username = 'root';
const password = 'Horapiaui@2026';

async function checkOS() {
    console.log(`Connecting to ${host}...`);
    try {
        await ssh.connect({
            host,
            username,
            password,
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
