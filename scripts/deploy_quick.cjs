const { NodeSSH } = require('node-ssh');
const path = require('path');
const fs = require('fs');
const os = require('os');
const dotenv = require('dotenv');
const { execSync } = require('child_process');

const ssh = new NodeSSH();

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
    throw new Error('Defina VPS_KEY_PATH (recomendado) ou tenha a chave padrao em ~/.ssh/fatopago_key. Em ultimo caso, use VPS_PASSWORD.');
}

const appDir = process.env.VPS_APP_DIR || '/var/www/fatopago';
const remoteTarget = process.env.VPS_DEPLOY_DIR || `${appDir}/dist`;
const localDist = path.join(__dirname, '../dist');
const frontendContainer = process.env.VPS_FRONTEND_CONTAINER || 'app_01_fatopago';
const internalHttpRoot = process.env.VPS_FRONTEND_INTERNAL_URL || 'http://127.0.0.1:4101/';
const internalHttpAdmin = process.env.VPS_FRONTEND_ADMIN_URL || 'http://127.0.0.1:4101/admin-dashboard';
const healthAttempts = Math.max(Number(process.env.VPS_FRONTEND_HEALTH_ATTEMPTS || 20), 1);
const healthDelayMs = Math.max(Number(process.env.VPS_FRONTEND_HEALTH_DELAY_MS || 1500), 250);

function shQuotePosix(value) {
    return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function assertSafeTarget(target) {
    if (!target || target === '/' || target === '/root' || target === '/var' || target === '/var/www') {
        throw new Error(`Destino remoto invalido: ${target}`);
    }
    if (!target.startsWith('/var/www/')) {
        throw new Error(`Destino remoto fora do allowlist: ${target}`);
    }
    if (!/^\/var\/www\/[A-Za-z0-9._/-]+$/.test(target) || target.includes('..')) {
        throw new Error(`Destino remoto contem caracteres invalidos: ${target}`);
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractAssetRefsFromHtml(html) {
    return Array.from(new Set(
        String(html || '')
            .match(/\/assets\/[^"' )]+/g) || []
    )).sort();
}

async function execChecked(command, options = {}) {
    const result = await ssh.execCommand(command, options);
    if (result.code !== 0) {
        throw new Error(result.stderr || `Falha ao executar comando remoto: ${command}`);
    }
    return result.stdout || '';
}

async function waitForHealthy() {
    for (let attempt = 1; attempt <= healthAttempts; attempt += 1) {
        const stdout = await execChecked(
            `docker inspect ${shQuotePosix(frontendContainer)} --format 'health={{.State.Health.Status}}'`
        );
        const status = String(stdout).trim();
        console.log(`healthcheck tentativa ${attempt}/${healthAttempts}: ${status}`);
        if (status === 'health=healthy') {
            return status;
        }
        await sleep(healthDelayMs);
    }

    throw new Error(`Container ${frontendContainer} nao atingiu health=healthy no tempo esperado.`);
}

async function probeHttp(url, label) {
    const stdout = await execChecked(
        `curl -sS -o /dev/null -w '${label}:%{http_code}' ${shQuotePosix(url)} || true`
    );
    const statusCode = String(stdout).trim().split(':').pop();
    if (statusCode !== '200') {
        throw new Error(`Probe HTTP falhou em ${label}. Esperado 200, recebido ${statusCode || 'desconhecido'}.`);
    }
    return String(stdout).trim();
}

async function fetchRemoteText(command) {
    const result = await ssh.execCommand(command);
    if (result.code !== 0) {
        throw new Error(result.stderr || `Falha ao ler conteudo remoto: ${command}`);
    }
    return result.stdout || '';
}

async function deployQuick() {
    console.log('Build local (dist limpa)...');
    if (fs.existsSync(localDist)) {
        fs.rmSync(localDist, { recursive: true, force: true });
    }
    execSync('npm run build', { stdio: 'inherit' });

    if (!fs.existsSync(localDist)) {
        throw new Error('Build falhou: pasta dist nao foi gerada.');
    }

    const localIndexHtml = fs.readFileSync(path.join(localDist, 'index.html'), 'utf8');
    const expectedAssets = extractAssetRefsFromHtml(localIndexHtml);
    if (expectedAssets.length === 0) {
        throw new Error('Build invalido: index.html local nao referencia assets versionados.');
    }

    console.log('Conectando na VPS...');
    try {
        assertSafeTarget(appDir);
        assertSafeTarget(remoteTarget);

        await ssh.connect({
            host,
            username,
            port,
            ...(privateKey ? { privateKey } : { password }),
            tryKeyboard: true,
            readyTimeout: 30000,
            keepaliveInterval: 10000,
        });

        const targetQ = shQuotePosix(remoteTarget);

        console.log('Preparando diretorio remoto...');
        await execChecked(`mkdir -p -- ${targetQ}`);

        console.log('Limpando apenas o conteudo remoto de dist...');
        await execChecked(`find ${targetQ} -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +`);

        console.log('Enviando novo dist...');
        const uploaded = await ssh.putDirectory(localDist, remoteTarget, {
            recursive: true,
            concurrency: 1,
        });

        if (!uploaded) {
            throw new Error('Falha ao enviar dist para a VPS.');
        }

        console.log('Ajustando permissoes minimas de leitura...');
        await execChecked(`chmod -R u=rwX,go=rX -- ${targetQ}`);

        console.log('Validando index.html remoto...');
        await execChecked(`test -f ${shQuotePosix(path.posix.join(remoteTarget, 'index.html'))}`);

        const remoteIndexHtml = await fetchRemoteText(`sed -n '1,120p' ${shQuotePosix(path.posix.join(remoteTarget, 'index.html'))}`);
        const remoteAssets = extractAssetRefsFromHtml(remoteIndexHtml);
        const missingRemoteAssets = expectedAssets.filter((asset) => !remoteAssets.includes(asset));
        if (missingRemoteAssets.length > 0) {
            throw new Error(`Assets esperados nao encontrados no index remoto: ${missingRemoteAssets.join(', ')}`);
        }

        console.log(`Reiniciando apenas o container ${frontendContainer}...`);
        await execChecked(`docker restart ${shQuotePosix(frontendContainer)}`);

        console.log('Aguardando healthcheck...');
        await waitForHealthy();

        console.log('Validando HTTP interno...');
        console.log(await probeHttp(internalHttpRoot, 'root'));
        console.log(await probeHttp(internalHttpAdmin, 'admin'));

        console.log('Validando assets publicados pelo HTML publico...');
        const publicHtml = await fetchRemoteText(`curl -fsS ${shQuotePosix(internalHttpRoot)}`);
        const publicAssets = extractAssetRefsFromHtml(publicHtml);
        const missingPublicAssets = expectedAssets.filter((asset) => !publicAssets.includes(asset));
        if (missingPublicAssets.length > 0) {
            throw new Error(`HTML publico nao publicou todos os assets novos: ${missingPublicAssets.join(', ')}`);
        }

        console.log('Deploy rapido concluido com sucesso.');
    } finally {
        ssh.dispose();
    }
}

deployQuick().catch((error) => {
    console.error('Deploy Failed:', error);
    process.exit(1);
});
