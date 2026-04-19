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

const config = `server {
    server_name fatopago.com www.fatopago.com;

    root /var/www/fatopago;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/fatopago.com/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/fatopago.com/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}
server {
    if ($host = www.fatopago.com) {
        return 301 https://$host$request_uri;
    } # managed by Certbot

    if ($host = fatopago.com) {
        return 301 https://$host$request_uri;
    } # managed by Certbot

    listen 80;
    server_name fatopago.com www.fatopago.com;
    return 404; # managed by Certbot
}
`;

async function updateConfig() {
    await ssh.connect({
        host,
        username,
        port,
        ...(privateKey ? { privateKey } : { password }),
        tryKeyboard: true
    });

    const writeConfig = `cat <<'EOF' > /etc/nginx/conf.d/fatopago.com.conf\n${config}EOF`;
    await ssh.execCommand(writeConfig);

    const test = await ssh.execCommand('nginx -t');
    if (test.stdout) console.log(test.stdout);
    if (test.stderr) console.error(test.stderr);

    const reload = await ssh.execCommand('systemctl reload nginx');
    if (reload.stdout) console.log(reload.stdout);
    if (reload.stderr) console.error(reload.stderr);

    ssh.dispose();
}

updateConfig().catch((error) => {
    console.error('Falha ao atualizar Nginx:', error);
    ssh.dispose();
    process.exit(1);
});
