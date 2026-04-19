
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
    console.log(`Diagnostic connecting to ${host}...`);
    try {
        await ssh.connect({
            host,
            username,
            port,
            password,
            tryKeyboard: true,
            // Increase timeout and retries generally
            readyTimeout: 20000,
        });
        console.log('Connected!');

        // Run checks
        const checks = [
            { cmd: 'whoami', label: 'User Check' },
            { cmd: 'systemctl status nginx --no-pager', label: 'Nginx Service Status' },
            { cmd: 'grep -r "root" /etc/nginx/conf.d/', label: 'Nginx Config Root Check' },
            { cmd: 'ls -ld /var/www/fatopago/dist', label: 'Dist Directory Permissions' },
            { cmd: 'ls -l /var/www/fatopago/dist/index.html', label: 'Index File Permissions' },
            { cmd: 'sestatus', label: 'SELinux Status' },
            { cmd: 'ls -Z /var/www/fatopago/dist/index.html', label: 'SELinux Context' },
            { cmd: 'cat /var/log/audit/audit.log | grep nginx | tail -n 5', label: 'Audit Log (SELinux Denials)' },
            { cmd: 'tail -n 20 /var/log/nginx/error.log', label: 'Nginx Error Log' }
        ];

        for (const check of checks) {
            console.log(`\n--- ${check.label} ---`);
            const result = await ssh.execCommand(check.cmd);
            console.log(result.stdout || result.stderr || '(no output)');
        }

        // AUTO-FIX ATTEMPT based on common issues
        console.log('\n--- ATTEMPTING PERMISSION FIXES ---');
        
        // 1. Ensure Nginx user can read
        await ssh.execCommand('chown -R nginx:nginx /var/www/fatopago/dist');
        await ssh.execCommand('chmod -R 755 /var/www/fatopago/dist');
        // Ensure parents are traversable
        await ssh.execCommand('chmod +x /var/www /var/www/fatopago');
        
        // 2. Fix SELinux context
        await ssh.execCommand('chcon -R -t httpd_sys_content_t /var/www/fatopago/dist');
        
        // 3. Restart Nginx if it was failed
        await ssh.execCommand('systemctl restart nginx');
        
        console.log('Fixes applied. Checking status again...');
        const fixCheck = await ssh.execCommand('systemctl status nginx --no-pager');
        console.log(fixCheck.stdout || fixCheck.stderr);

        ssh.dispose();

    } catch (error) {
        console.error('Diagnosis Failed:', error);
        ssh.dispose();
    }
}

diagnose();
