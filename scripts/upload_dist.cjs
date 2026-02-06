const { NodeSSH } = require('node-ssh');
const fs = require('fs');
const path = require('path');

const ssh = new NodeSSH();

function loadDotEnvIfPresent(filePath) {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const eqIndex = line.indexOf('=');
        if (eqIndex === -1) continue;
        const key = line.slice(0, eqIndex).trim();
        let value = line.slice(eqIndex + 1).trim();
        if (!key) continue;

        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }

        if (process.env[key] == null || process.env[key] === '') {
            process.env[key] = value;
        }
    }
}

async function uploadDist() {
    try {
        const envPaths = [
            path.join(__dirname, '../.env.local'),
            path.join(__dirname, '../.env')
        ];
        for (const p of envPaths) loadDotEnvIfPresent(p);

        const host = process.env.VPS_HOST;
        if (!host) {
            throw new Error('VPS_HOST environment variable is required');
        }
        const username = process.env.VPS_USER || 'root';
        const password = process.env.VPS_PASSWORD;
        const privateKey = process.env.VPS_KEY_PATH;
        const port = process.env.VPS_PORT ? Number(process.env.VPS_PORT) : undefined;

        if (!host || !username) {
            throw new Error('Variáveis VPS_HOST e VPS_USER são obrigatórias.');
        }
        if (!privateKey && !password) {
            throw new Error('Defina VPS_KEY_PATH (recomendado) ou VPS_PASSWORD no ambiente.');
        }

        console.log('Conectando na VPS...');
        await ssh.connect({
            host,
            username,
            port,
            ...(privateKey ? { privateKey } : { password }),
            tryKeyboard: true,
            readyTimeout: 30000
        });

        console.log('Limpando dist remoto...');
        await ssh.execCommand('rm -rf /var/www/fatopago/dist');
        await ssh.execCommand('mkdir -p /var/www/fatopago');

        console.log('Enviando dist...');
        const localDist = path.join(__dirname, '../dist');
        await ssh.putDirectory(localDist, '/var/www/fatopago/dist', {
            recursive: true,
            concurrency: 1
        });

        console.log('✅ Deploy concluído com sucesso!');
        ssh.dispose();
    } catch (error) {
        console.error('❌ Erro no deploy:', error);
        ssh.dispose();
        process.exit(1);
    }
}

uploadDist();
