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

async function deepAudit() {
    try {
        console.log('Conectando na VPS...');
        await ssh.connect({
            host,
            username,
            port,
            ...(privateKey ? { privateKey } : { password }),
            tryKeyboard: true,
            readyTimeout: 30000
        });

        console.log('\n--- AUDITORIA DE DIRETÓRIOS ---');
        console.log('Listando /var/www/fatopago:');
        const lsRoot = await ssh.execCommand('ls -R /var/www/fatopago');
        console.log(lsRoot.stdout);

        console.log('\n--- CONFIGURAÇÃO DO NGINX ---');
        console.log('Procurando arquivos de config:');
        const nginxConfigs = await ssh.execCommand('grep -r "fatopago" /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null');
        console.log(nginxConfigs.stdout);

        if (nginxConfigs.stdout) {
            const firstFile = nginxConfigs.stdout.split(':')[0];
            console.log(`\nConteúdo de ${firstFile}:`);
            const catConfig = await ssh.execCommand(`cat ${firstFile}`);
            console.log(catConfig.stdout);
        }

        ssh.dispose();
    } catch (error) {
        console.error('❌ Erro:', error);
        ssh.dispose();
        process.exit(1);
    }
}

deepAudit();
