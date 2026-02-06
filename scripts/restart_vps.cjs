const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const host = process.env.VPS_HOST;
if (!host) throw new Error('VPS_HOST environment variable is required');
const username = process.env.VPS_USER || 'root';
const password = process.env.VPS_PASSWORD;
const privateKey = process.env.VPS_KEY_PATH;
const port = process.env.VPS_PORT ? Number(process.env.VPS_PORT) : undefined;

if (!host || !username) {
    throw new Error('Defina VPS_HOST e VPS_USER no ambiente.');
}
if (!privateKey && !password) {
    throw new Error('Defina VPS_KEY_PATH (recomendado) ou VPS_PASSWORD no ambiente.');
}

async function restartServices() {
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

        console.log('\n🔄 Reiniciando PM2 fatopago...');
        const pm2Result = await ssh.execCommand('pm2 restart fatopago-api --update-env || pm2 restart fatopago --update-env || pm2 restart all --update-env');
        console.log(pm2Result.stdout);

        console.log('\n🧹 Limpando cache do Nginx...');
        const cacheResult = await ssh.execCommand('rm -rf /var/cache/nginx/* && nginx -s reload');
        console.log('Cache limpo e Nginx recarregado!');

        console.log('\n✅ Serviços reiniciados com sucesso!');
        console.log('\n💡 Agora faça CTRL+SHIFT+R no navegador para limpar o cache local');

        ssh.dispose();
    } catch (error) {
        console.error('❌ Erro:', error);
        ssh.dispose();
        process.exit(1);
    }
}

restartServices();
