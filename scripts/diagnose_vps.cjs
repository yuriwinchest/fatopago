
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
            password,
            tryKeyboard: true
        });
        console.log('Connected!');

        console.log('\n--- NGINX STATUS ---');
        const status = await ssh.execCommand('systemctl status nginx --no-pager');
        console.log(status.stdout || status.stderr);

        console.log('\n--- NGINX CONFIG TEST ---');
        const configTest = await ssh.execCommand('nginx -t');
        console.log(configTest.stdout || configTest.stderr);

        console.log('\n--- LIST DIST DIR ---');
        const listDist = await ssh.execCommand('ls -ld /var/www/fatopago/dist');
        console.log(listDist.stdout || listDist.stderr);

        console.log('\n--- LIST INDEX.HTML ---');
        const listIndex = await ssh.execCommand('ls -l /var/www/fatopago/dist/index.html');
        console.log(listIndex.stdout || listIndex.stderr);

        console.log('\n--- SELINUX STATUS ---');
        const selinux = await ssh.execCommand('sestatus');
        console.log(selinux.stdout || selinux.stderr);

        console.log('\n--- SELINUX CONTEXT ---');
        const context = await ssh.execCommand('ls -Z /var/www/fatopago/dist/index.html');
        console.log(context.stdout || context.stderr);

        console.log('\n--- PROCESS LIST (nginx) ---');
        const ps = await ssh.execCommand('ps aux | grep nginx');
        console.log(ps.stdout || ps.stderr);

        console.log('\n--- ERROR LOGIN (tail) ---');
        const logs = await ssh.execCommand('tail -n 20 /var/log/nginx/error.log');
        console.log(logs.stdout || logs.stderr);
        
        console.log('\n--- CHECK PARENT PERMISSIONS ---');
        // namei might not be installed, try simple ls -ld path parts
        const p1 = await ssh.execCommand('ls -ld /var');
        console.log('/var: ' + (p1.stdout.trim()));
        const p2 = await ssh.execCommand('ls -ld /var/www');
        console.log('/var/www: ' + (p2.stdout.trim()));
        const p3 = await ssh.execCommand('ls -ld /var/www/fatopago');
        console.log('/var/www/fatopago: ' + (p3.stdout.trim()));

        ssh.dispose();

    } catch (error) {
        console.error('Diagnosis Failed:', error);
        ssh.dispose();
    }
}

diagnose();
