const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

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

const appDir = process.env.VPS_APP_DIR || '/var/www/fatopago';
const localDist = path.join(__dirname, '../dist');
const remoteTarget = process.env.VPS_DEPLOY_DIR || appDir;

function assertSafeTarget(target) {
    if (!target || target === '/' || target === '/root' || target === '/var' || target === '/var/www') {
        throw new Error(`Destino remoto inválido: ${target}`);
    }
    if (!target.startsWith('/var/www/')) {
        throw new Error(`Destino remoto fora do allowlist: ${target}`);
    }
}

async function deployUpdate() {
    console.log('Build local (dist limpa)...');
    if (fs.existsSync(localDist)) {
        fs.rmSync(localDist, { recursive: true, force: true });
    }
    execSync('npm run build', { stdio: 'inherit' });
    console.log('Validando dist...');
    if (!fs.existsSync(localDist)) {
        throw new Error('Build falhou: pasta dist não foi gerada.');
    }

    console.log('Conectando na VPS...');
    try {
        assertSafeTarget(remoteTarget);
        await ssh.connect({
            host,
            username,
            port,
            ...(privateKey ? { privateKey } : { password }),
            tryKeyboard: true,
            readyTimeout: 30000,
            keepaliveInterval: 10000
        });
        console.log('Limpando destino remoto...');
        await ssh.execCommand(`rm -rf ${remoteTarget}/*`);
        await ssh.execCommand(`mkdir -p ${remoteTarget}`);

        console.log('Enviando dist...');
        await ssh.putDirectory(localDist, remoteTarget, {
            recursive: true,
            concurrency: 1
        });

        console.log('Reiniciando PM2...');
        try {
            // Some setups use PM2 to serve the dist folder or run a node server
            const restart = await ssh.execCommand('pm2 restart fatopago || pm2 start "npx serve -s dist" --name fatopago', { cwd: appDir });
            if (restart.stderr) {
                console.error(restart.stderr);
            }
        } catch (err) {
            console.error('Restart failed:', err);
        }

        console.log('Deploy concluído.');

        ssh.dispose();

    } catch (error) {
        console.error('Deploy Failed:', error);
        ssh.dispose();
        process.exit(1);
    }
}

deployUpdate();
