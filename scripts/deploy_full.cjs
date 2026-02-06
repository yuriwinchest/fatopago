const path = require('path');
const dotenv = require('dotenv');
// Tenta carregar .env.local primeiro (prioridade), depois .env
dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });
const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
const fs = require('fs');
const { execSync } = require('child_process');

const host = process.env.VPS_HOST;
const username = process.env.VPS_USER;
const password = process.env.VPS_PASSWORD;
const privateKey = process.env.VPS_KEY_PATH;
const port = process.env.VPS_PORT ? Number(process.env.VPS_PORT) : 22;

if (!host || !username) {
    throw new Error('Defina VPS_HOST e VPS_USER no ambiente.');
}
if (!privateKey && !password) {
    throw new Error('Defina VPS_KEY_PATH (recomendado) ou VPS_PASSWORD no ambiente.');
}

const appDir = process.env.VPS_APP_DIR || '/var/www/fatopago';
// Diretório onde o backend vai rodar
const remoteServerDir = appDir; 
const localDist = path.join(__dirname, '../dist');
const localServer = path.join(__dirname, '../server');
const localPackageJson = path.join(__dirname, '../package.json');
const localPackageLock = path.join(__dirname, '../package-lock.json');

async function deployFullStack() {
    console.log('🚀 Iniciando Deploy Full Stack...');

    // 1. Build Frontend
    console.log('📦 Building Frontend...');
    if (fs.existsSync(localDist)) {
        fs.rmSync(localDist, { recursive: true, force: true });
    }
    execSync('npm run build', { stdio: 'inherit' });

    if (!fs.existsSync(localDist)) {
        throw new Error('Build falhou: pasta dist não encontrada.');
    }

    console.log('🔌 Conectando na VPS...');
    try {
        await ssh.connect({
            host,
            username,
            port,
            ...(privateKey ? { privateKey } : { password }),
            tryKeyboard: true,
            readyTimeout: 30000
        });

        // 2. Preparar estrutura remota
        console.log('🧹 Limpando diretórios remotos...');
        // NÃO apagar node_modules se existir para economizar tempo, apenas código
        // Mas para garantir limpamos dist e server
        await ssh.execCommand(`rm -rf ${remoteServerDir}/dist ${remoteServerDir}/server`);
        await ssh.execCommand(`mkdir -p ${remoteServerDir}/dist ${remoteServerDir}/server ${remoteServerDir}/certs`);

        // 3. Upload Arquivos
        console.log('📤 Enviando arquivos...');
        
        // Frontend dist
        await ssh.putDirectory(localDist, `${remoteServerDir}/dist`, {
            recursive: true,
            concurrency: 5
        });

        // Backend server code
        await ssh.putDirectory(localServer, `${remoteServerDir}/server`, {
            recursive: true,
            concurrency: 5
        });

        // Package.json para dependências
        await ssh.putFile(localPackageJson, `${remoteServerDir}/package.json`);
        await ssh.putFile(localPackageLock, `${remoteServerDir}/package-lock.json`);

        // 4. Instalar Dependências no Servidor
        console.log('📦 Instalando dependências na VPS (isso pode demorar)...');
        // Usar --production para pular devDependencies (lightweight)
        const installCmd = await ssh.execCommand('npm ci --production', { cwd: remoteServerDir });
        if (installCmd.stderr && !installCmd.stderr.includes('warn')) { 
            // npm ci as vezes manda output pro stderr mesmo com sucesso, mas vamos logar
            console.log('NPM Output:', installCmd.stdout);
            console.error('NPM Error (pode ser warning):', installCmd.stderr);
        } else {
            console.log('Dependências instaladas.');
        }

        // 5. Reiniciar Aplicação
        console.log('🔄 Reiniciando PM2...');
        // Comando para iniciar/reiniciar o servidor Node
        // O servidor server/index.js agora serve o ../dist
        const pm2Cmd = `pm2 restart fatopago || pm2 start server/index.js --name fatopago --cron-restart="0 4 * * *"`;
        
        const restart = await ssh.execCommand(pm2Cmd, { cwd: remoteServerDir });
        console.log(restart.stdout);
        if (restart.stderr) console.error(restart.stderr);

        console.log('✅ Deploy Full Stack Concluído com Sucesso!');

    } catch (error) {
        console.error('❌ Deploy Falhou:', error);
        process.exit(1);
    } finally {
        ssh.dispose();
    }
}

deployFullStack();
