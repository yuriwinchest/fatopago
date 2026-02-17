const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
const path = require('path');
const fs = require('fs');
const os = require('os');
const dotenv = require('dotenv');
const { execSync } = require('child_process');

// Load env from repo files (vps-upload-rules.md expects this to work).
dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config({ path: path.join(__dirname, '../.env') });

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

if (!host || !username) {
    throw new Error('Defina VPS_HOST e VPS_USER no ambiente.');
}
if (!privateKey && !password) {
    throw new Error('Defina VPS_KEY_PATH (recomendado) ou tenha a chave padrão em ~/.ssh/fatopago_key. Em último caso, use VPS_PASSWORD (apenas para provisionar a chave).');
}

const appDir = process.env.VPS_APP_DIR || '/var/www/fatopago';
const localDist = path.join(__dirname, '../dist');
const remoteTarget = process.env.VPS_DEPLOY_DIR || `${appDir}/dist`;

function shQuotePosix(s) {
    // Safe because we validate allowed chars; still quote to avoid whitespace surprises.
    return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

function assertSafeTarget(target) {
    if (!target || target === '/' || target === '/root' || target === '/var' || target === '/var/www') {
        throw new Error(`Destino remoto inválido: ${target}`);
    }
    if (!target.startsWith('/var/www/')) {
        throw new Error(`Destino remoto fora do allowlist: ${target}`);
    }
    // Block shell metacharacters / weird paths. Keep it simple and strict.
    if (!/^\/var\/www\/[A-Za-z0-9._/-]+$/.test(target) || target.includes('..')) {
        throw new Error(`Destino remoto contém caracteres inválidos: ${target}`);
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
        assertSafeTarget(appDir);
        await ssh.connect({
            host,
            username,
            port,
            ...(privateKey ? { privateKey } : { password }),
            tryKeyboard: true,
            readyTimeout: 30000,
            keepaliveInterval: 10000
        });
        console.log('Preparando destino remoto...');
        const targetQ = shQuotePosix(remoteTarget);
        await ssh.execCommand(`mkdir -p -- ${targetQ}`);

        // Zero-downtime strategy for static deploy:
        // 1) upload hashed assets first
        // 2) upload remaining static files
        // 3) upload index.html last (switches app shell to new asset hashes)
        const localAssets = path.join(localDist, 'assets');
        const remoteAssets = `${remoteTarget}/assets`;
        if (fs.existsSync(localAssets)) {
            console.log('Enviando assets...');
            await ssh.putDirectory(localAssets, remoteAssets, {
                recursive: true,
                concurrency: 1
            });
        }

        const topLevelEntries = fs.readdirSync(localDist, { withFileTypes: true });
        console.log('Enviando arquivos estaticos...');
        for (const entry of topLevelEntries) {
            if (entry.name === 'assets' || entry.name === 'index.html') continue;
            const localEntry = path.join(localDist, entry.name);
            const remoteEntry = `${remoteTarget}/${entry.name}`;

            if (entry.isDirectory()) {
                await ssh.putDirectory(localEntry, remoteEntry, {
                    recursive: true,
                    concurrency: 1
                });
                continue;
            }

            if (entry.isFile()) {
                await ssh.putFile(localEntry, remoteEntry);
            }
        }

        const localIndex = path.join(localDist, 'index.html');
        const remoteIndex = `${remoteTarget}/index.html`;
        console.log('Publicando index.html (etapa final)...');
        await ssh.putFile(localIndex, remoteIndex);

        console.log('Aplicando permissoes...');
        await ssh.execCommand(`chmod -R u=rwX,go=rX -- ${targetQ}`);
        // Keep nginx ownership so static files are always readable.
        await ssh.execCommand(`if [ "$(id -u)" = "0" ]; then chown -R nginx:nginx -- ${targetQ} || true; fi`);

        console.log('Sincronizacao concluida.');

        console.log('Limpando PM2 (somente se existir processo fatopago)...');
        try {
            // Current VPS setup serves the frontend statically via nginx container (no PM2 needed).
            // Still, if an old PM2 process exists, restart/flush it without touching other processes.
            const cmd =
                'if pm2 describe fatopago >/dev/null 2>&1; then ' +
                'pm2 flush fatopago >/dev/null 2>&1 || true; ' +
                'pm2 restart fatopago --update-env >/dev/null 2>&1 || true; ' +
                'echo \"pm2:fatopago=ok\"; ' +
                'else echo \"pm2:fatopago=not_found\"; fi';
            const r = await ssh.execCommand(cmd, { cwd: appDir });
            if (r.stdout) console.log(r.stdout.trim());
            if (r.stderr) console.error(r.stderr.trim());
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
