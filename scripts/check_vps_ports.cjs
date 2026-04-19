/* eslint-disable @typescript-eslint/no-var-requires */

const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
const fs = require('fs');
const os = require('os');
const path = require('path');

const host = process.env.VPS_HOST;
const username = process.env.VPS_USER || 'root';
const password = process.env.VPS_PASSWORD;
const defaultKeyPath = path.join(os.homedir(), '.ssh', 'fatopago_key');
const privateKeyRaw = process.env.VPS_KEY_PATH || (fs.existsSync(defaultKeyPath) ? defaultKeyPath : undefined);
const privateKey =
    privateKeyRaw &&
    typeof privateKeyRaw === 'string' &&
    !privateKeyRaw.includes('BEGIN') &&
    fs.existsSync(privateKeyRaw)
        ? fs.readFileSync(privateKeyRaw, 'utf8')
        : privateKeyRaw;
const port = process.env.VPS_PORT ? Number(process.env.VPS_PORT) : undefined;

if (!host) throw new Error('Defina VPS_HOST no ambiente.');
if (!privateKey && !password) {
    throw new Error('Defina VPS_KEY_PATH (recomendado) ou tenha a chave padrão em ~/.ssh/fatopago_key. Em último caso, use VPS_PASSWORD.');
}

async function _checkVpsNetwork() {
    console.log(`Connecting to ${host}...`);
    try {
        await ssh.connect({
            host,
            username,
            port,
            ...(privateKey ? { privateKey } : { password }),
            tryKeyboard: true,
        });
        console.log('Connected! Checking Exposed Ports and APIs...\n');

        // 1. Check Listening Ports
        console.log('--- Detected Open Ports (netstat/ss) ---');
        try {
            const netstat = await ssh.execCommand('netstat -tulpn | grep LISTEN');
            if (netstat.stdout) {
                console.log(netstat.stdout);
            } else {
                // Fallback to ss if netstat missing
                const ss = await ssh.execCommand('ss -tulpn | grep LISTEN');
                console.log(ss.stdout || 'No listening ports found or command failed.');
            }
        } catch (e) {
            console.log('Error running netstat/ss:', e.message);
        }

        console.log('\n--- Running Node Processes ---');
        const nodeProcs = await ssh.execCommand('ps aux | grep node | grep -v grep');
        console.log(nodeProcs.stdout || 'No node processes found.');

        console.log('\n--- PM2 List ---');
        // Try to list pm2 processes
        const pm2List = await ssh.execCommand('pm2 list');
        console.log(pm2List.stdout || pm2List.stderr || 'PM2 list failed or empty.');

        console.log('\n--- Nginx Sites Enabled ---');
        // Check nginx config to see what domains/ports are mapped
        const nginx = await ssh.execCommand('ls -la /etc/nginx/sites-enabled/');
        if (nginx.stdout) {
            console.log(nginx.stdout);
            // Read the content of the config files if found

            // Just cat all files in sites-enabled for simplicity
            const nginxConfigs = await ssh.execCommand('cat /etc/nginx/sites-enabled/*');
            console.log('\n[Nginx Config Content]:\n', nginxConfigs.stdout);
        } else {
            console.log('No sites-enabled found or nginx not installed/configured standardly.');
        }

        ssh.dispose();

    } catch (error) {
        console.error('Remote Verification Failed:', error);
        ssh.dispose();
    }
}

async function deepCheck() {
    console.log(`Connecting to ${host} for FINAL SECURITY LOCKDOWN...`);
    try {
        await ssh.connect({
            host,
            username,
            port,
            ...(privateKey ? { privateKey } : { password }),
            tryKeyboard: true
        });

        // 1. VERIFY NGINX CONFIG
        console.log('\n--- 1. VERIFYING NGINX PROXY ---');
        const nginxConf = await ssh.execCommand('cat /etc/nginx/conf.d/fatopago.com.conf');
        console.log(nginxConf.stdout);

        if (nginxConf.stdout.includes('proxy_pass')) {
            console.log('✅ Proxy pass detected. Nginx is likely handling traffic correctly.');
        } else {
            console.log('⚠️  WARNING: No proxy_pass found! Site might be serving static files or misconfigured.');
        }

        // 2. ENABLE FIREWALL (UFW)
        console.log('\n--- 2. ACTIVATING FIREWALL (UFW) ---');

        // Allow critical ports FIRST
        console.log('Allowing SSH (22)...');
        await ssh.execCommand('ufw allow 22/tcp');

        console.log('Allowing HTTP (80)...');
        await ssh.execCommand('ufw allow 80/tcp');

        console.log('Allowing HTTPS (443)...');
        await ssh.execCommand('ufw allow 443/tcp');

        // Enable
        console.log('Enabling UFW...');
        const enable = await ssh.execCommand('ufw --force enable');
        console.log(enable.stdout || enable.stderr);

        // 3. FINAL STATUS
        console.log('\n--- 3. FINAL STATUS ---');
        const status = await ssh.execCommand('ufw status verbose');
        console.log(status.stdout);

        ssh.dispose();
    } catch (e) {
        console.error('❌ ERROR:', e.message);
        ssh.dispose();
    }
}

_checkVpsNetwork();
