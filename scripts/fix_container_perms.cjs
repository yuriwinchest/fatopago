
const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Carregar variáveis
dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const host = process.env.VPS_HOST;
const username = process.env.VPS_USER || 'root';
const password = process.env.VPS_PASSWORD;
const port = process.env.VPS_PORT ? Number(process.env.VPS_PORT) : 22;

async function fix() {
    console.log(`Connecting to ${host}...`);
    try {
        await ssh.connect({
            host,
            username,
            port,
            password,
            tryKeyboard: true,
            readyTimeout: 30000
        });
        console.log('Connected!');

        console.log('--- Cleaning up Host Nginx (prevents conflict) ---');
        await ssh.execCommand('systemctl stop nginx');
        await ssh.execCommand('systemctl disable nginx');
        
        console.log('--- Fixing Permissions for Container ---');
        // Directories need +x for traversal
        await ssh.execCommand('chmod 755 /var');
        await ssh.execCommand('chmod 755 /var/www');
        await ssh.execCommand('chmod 755 /var/www/fatopago');
        await ssh.execCommand('chmod 755 /var/www/fatopago/dist');
        
        // Files need +r
        await ssh.execCommand('chmod -R 755 /var/www/fatopago/dist');
        
        // SELinux (Critical for RHEL/Alma)
        // Set type to httpd_sys_content_t so container can read it
        console.log('--- Applying SELinux Context ---');
        await ssh.execCommand('chcon -R -t httpd_sys_content_t /var/www/fatopago/dist');
        
        console.log('--- Restarting Application Container ---');
        // Try to restart the specific container. 
        // Need to find the docker compose command or container name.
        // The doc says container name is 'app_01_fatopago'.
        await ssh.execCommand('docker restart app_01_fatopago');
        
        console.log('--- Setup Complete ---');
        
        // Check logs of container to see if it complains
        const logs = await ssh.execCommand('docker logs --tail 20 app_01_fatopago');
        console.log('Container Logs:', logs.stdout || logs.stderr);

        ssh.dispose();

    } catch (error) {
        console.error('Fix Failed:', error);
        ssh.dispose();
    }
}

fix();
