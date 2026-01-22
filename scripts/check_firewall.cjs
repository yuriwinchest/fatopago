
const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

// VPS Credentials
const host = '72.60.53.191';
const username = 'root';
const password = 'Horapiaui@2026';

async function checkFirewall() {
    console.log(`Connecting to ${host}...`);
    try {
        await ssh.connect({
            host,
            username,
            password
        });

        console.log('--- Firewalld Status ---');
        try {
            const firewalld = await ssh.execCommand('firewall-cmd --list-all');
            console.log(firewalld.stdout || 'Not output');
        } catch (e) { console.log('Firewalld error or not installed'); }

        ssh.dispose();

    } catch (error) {
        console.error('Check Failed:', error);
        ssh.dispose();
    }
}

checkFirewall();
