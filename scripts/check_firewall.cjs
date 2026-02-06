
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

async function checkFirewall() {
    console.log(`Connecting to ${host}...`);
    try {
        await ssh.connect({
            host,
            username,
            port,
            ...(privateKey ? { privateKey } : { password })
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
