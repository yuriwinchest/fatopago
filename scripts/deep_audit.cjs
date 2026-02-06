const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

const host = process.env.VPS_HOST;
const username = process.env.VPS_USER;
const password = process.env.VPS_PASSWORD;
const privateKey = process.env.VPS_KEY_PATH;
const port = process.env.VPS_PORT ? Number(process.env.VPS_PORT) : undefined;

if (!host || !username) {
    throw new Error('Defina VPS_HOST e VPS_USER no ambiente.');
}
if (!privateKey && !password) {
    throw new Error('Defina VPS_KEY_PATH (recomendado) ou VPS_PASSWORD no ambiente.');
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
