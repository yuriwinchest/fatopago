
const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
const fs = require('fs');
const os = require('os');
const path = require('path');

const host = process.env.VPS_HOST;
const username = process.env.VPS_USER;
const password = process.env.VPS_PASSWORD;
const port = process.env.VPS_PORT ? Number(process.env.VPS_PORT) : 22;

async function diagnose() {
    console.log(`Connecting to ${host}...`);
    try {
        await ssh.connect({
            host,
            username,
            port,
            password: password, // Assegurando uso explicito da senha
            tryKeyboard: true,
            // Aumentar timeouts
            readyTimeout: 60000,
            handshakeTimeout: 60000
        });
        console.log('Connected!');

        console.log('--- Applying Permissions Fix ---');

        // Force SELinux to permissive for httpd just in case (easiest fix if blocked)
        await ssh.execCommand('setsebool -P httpd_read_user_content 1');
        await ssh.execCommand('setsebool -P httpd_enable_homedirs 1'); 

        // Apply strict permissions to web root
        // 1. Ownership
        await ssh.execCommand('chown -R nginx:nginx /var/www/fatopago');
        
        // 2. Directory permissions (execute needed for traversal)
        await ssh.execCommand('find /var/www/fatopago -type d -exec chmod 755 {} \\;');
        
        // 3. File permissions (read needed)
        await ssh.execCommand('find /var/www/fatopago -type f -exec chmod 644 {} \\;');

        // 4. SELinux Context (CRITICAL for RedHat/AlmaLinux)
        // If semanage is available, use it first for persistence
        await ssh.execCommand('semanage fcontext -a -t httpd_sys_content_t "/var/www/fatopago(/.*)?"');
        await ssh.execCommand('restorecon -R /var/www/fatopago');
        
        // Fallback: direct chcon if semanage failed or to be sure
        await ssh.execCommand('chcon -R -t httpd_sys_content_t /var/www/fatopago');

        // Restart Nginx
        console.log('Restarting Nginx...');
        const restart = await ssh.execCommand('systemctl restart nginx');
        if (restart.stderr) console.error('Restart Error:', restart.stderr);
        else console.log('Nginx restarted successfully.');

        // Verify status
        const status = await ssh.execCommand('systemctl status nginx --no-pager');
        console.log(status.stdout);

        ssh.dispose();

    } catch (error) {
        console.error('Connection Failed:', error);
        ssh.dispose();
    }
}

diagnose();
