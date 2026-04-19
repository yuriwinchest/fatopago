
const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const host = process.env.VPS_HOST;
const username = process.env.VPS_USER || 'root';
const password = process.env.VPS_PASSWORD;
const port = 22;

async function attemptRescue() {
    console.log(`ATTEMPTING RESCUE ON HOST ${host}...`);
    
    let connected = false;
    let attempts = 0;
    while (!connected && attempts < 5) {
        try {
            console.log(`Connecting attempt ${attempts + 1}...`);
            await ssh.connect({
                host,
                username,
                port,
                password, // Explicitly use password
                tryKeyboard: true,
                readyTimeout: 60000,
                handshakeTimeout: 60000,
                keepaliveInterval: 10000
            });
            connected = true;
            console.log('CONNECTED SUCCESFULLY!');
        } catch (err) {
            console.error(`Connection failed: ${err.message}`);
            attempts++;
            await new Promise(r => setTimeout(r, 5000)); // Wait 5s before retry
        }
    }

    if (!connected) {
        console.error('CRITICAL FAILURE: Could not connect after 5 attempts.');
        process.exit(1);
    }

    try {
        console.log('--- 1. STOPPING CONFLICTING NGINX ---');
        // Stop the native nginx that collided with Traefik
        await ssh.execCommand('systemctl stop nginx');
        await ssh.execCommand('systemctl disable nginx');
        console.log('Native Nginx stopped.');

        console.log('--- 2. RESTORING DOCKER VOLUME PERMISSIONS ---');
        // Fix permissions so container can read dist
        // Using explicit paths from documentation
        const webRoot = '/var/www';
        const appRoot = '/var/www/fatopago';
        const distRoot = '/var/www/fatopago/dist';

        // Ensure directories are traverseable (755)
        await ssh.execCommand(`chmod 755 ${webRoot}`);
        await ssh.execCommand(`chmod 755 ${appRoot}`);
        await ssh.execCommand(`chmod 755 ${distRoot}`);
        
        // Ensure files are readable (644)
        await ssh.execCommand(`chmod -R 755 ${distRoot}`); // 755 recursive is overkill but safe for read/exec
        
        // Ownership: some setups use root, some use nginx:nginx inside container. 
        // Safer to grant broad read access or match internal user (often 101 or 33).
        // Standard nginx:alpine runs as nginx (101) or root.
        await ssh.execCommand(`chown -R 1001:1001 ${distRoot} || chown -R 101:101 ${distRoot}`); 
        // Default to root:root with broad read permissions is usually safest if ID mapping is unknown
        await ssh.execCommand(`chmod -R o+rx ${distRoot}`);

        console.log('--- 3. APPLYING SELINUX CONTEXT (ALMALINUX) ---');
        // This is the most likely cause of 403 on RHEL based systems with bind mounts
        await ssh.execCommand(`chcon -R -t httpd_sys_content_t ${distRoot}`);
        await ssh.execCommand(`chcon -R -t httpd_sys_content_t ${appRoot}`);

        console.log('--- 4. RESTARTING DOCKER CONTAINER ---');
        // Restart the specific app container to pick up changes/mounts
        // Using name from documentation: app_01_fatopago
        const restart = await ssh.execCommand('docker restart app_01_fatopago');
        if (restart.stderr) console.log('Restart output:', restart.stderr);
        else console.log('Container restarted.');

        console.log('--- RESCUE COMPLETE ---');
        ssh.dispose();

    } catch (err) {
        console.error('Execution Error:', err);
        ssh.dispose();
    }
}

attemptRescue();
