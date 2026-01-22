
const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
const fs = require('fs');
const path = require('path');

// VPS Credentials
const host = '72.60.53.191';
const username = 'root';
const password = 'Horapiaui@2026';

// Nginx config template with Fix for React Router and SPA (try_files $uri $uri/ /index.html)
// Also configured with generic paths to work with our previous deployment
const nginxConfig = `server {
    listen 80;
    server_name fatopago.com www.fatopago.com;

    root /var/www/fatopago/dist;
    index index.html;

    # FIX: React Router SPA Support
    # Any request that doesn't match a file/folder redirects to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Optional: Cache static assets
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, no-transform";
    }
}
`;

const configPath = path.join(__dirname, 'fatopago_nginx.conf');
fs.writeFileSync(configPath, nginxConfig);

async function fixNginx() {
    console.log(`Connecting to ${host}...`);
    try {
        await ssh.connect({
            host,
            username,
            password,
            tryKeyboard: true,
        });
        console.log('Connected!');

        // Upload new config
        console.log('Uploading Nginx Config...');
        await ssh.putFile(configPath, '/etc/nginx/conf.d/fatopago.com.conf');

        // Remove default site if exists
        await ssh.execCommand('rm -f /etc/nginx/conf.d/default.conf');

        // Test configuration
        console.log('Testing Nginx Configuration...');
        const test = await ssh.execCommand('nginx -t');
        console.log(test.stdout);
        console.log(test.stderr);

        if (test.code === 0) {
            console.log('Configuration OK. Restarting Nginx...');
            await ssh.execCommand('systemctl restart nginx');
            console.log('Nginx Restarted!');
        } else {
            console.error('Nginx Configuration Test Failed!');
        }

        ssh.dispose();

    } catch (error) {
        console.error('Fix Failed:', error);
        ssh.dispose();
    }
}

fixNginx();
