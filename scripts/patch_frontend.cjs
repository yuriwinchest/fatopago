
const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
const fs = require('fs');
const os = require('os');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const host = process.env.VPS_HOST;
if (!host) throw new Error('VPS_HOST environment variable is required');
const username = process.env.VPS_USER || 'root';
const password = process.env.VPS_PASSWORD;
const defaultKeyPath = path.join(os.homedir(), '.ssh', 'fatopago_key');
const privateKeyRaw = process.env.VPS_KEY_PATH || (fs.existsSync(defaultKeyPath) ? defaultKeyPath : undefined);
const privateKey =
    privateKeyRaw && typeof privateKeyRaw === 'string' && !privateKeyRaw.includes('BEGIN') && fs.existsSync(privateKeyRaw)
        ? fs.readFileSync(privateKeyRaw, 'utf8')
        : privateKeyRaw;
const port = process.env.VPS_PORT ? Number(process.env.VPS_PORT) : undefined;

if (!host || !username) {
    throw new Error('Defina VPS_HOST e VPS_USER no ambiente.');
}
if (!privateKey && !password) {
    throw new Error('Defina VPS_KEY_PATH (recomendado) ou VPS_PASSWORD no ambiente.');
}

const filesToUpload = [
    { local: '../index.html', remote: '/var/www/fatopago/index.html' },
    { local: '../tsconfig.json', remote: '/var/www/fatopago/tsconfig.json' },
    { local: '../tsconfig.node.json', remote: '/var/www/fatopago/tsconfig.node.json' },
    { local: '../src/main.tsx', remote: '/var/www/fatopago/src/main.tsx' },
    { local: '../src/components/ErrorBoundary.tsx', remote: '/var/www/fatopago/src/components/ErrorBoundary.tsx' },
    { local: '../src/components/PixPaymentModal.tsx', remote: '/var/www/fatopago/src/components/PixPaymentModal.tsx' },
    { local: '../src/components/WithdrawalModal.tsx', remote: '/var/www/fatopago/src/components/WithdrawalModal.tsx' },
    { local: '../src/lib/pixPaymentService.ts', remote: '/var/www/fatopago/src/lib/pixPaymentService.ts' },
    { local: '../src/pages/LandingPage.tsx', remote: '/var/www/fatopago/src/pages/LandingPage.tsx' },
    { local: '../src/pages/Plans.tsx', remote: '/var/www/fatopago/src/pages/Plans.tsx' },
];

async function patchFrontend() {
    console.log(`Connecting to ${host}...`);
    try {
        await ssh.connect({
            host,
            username,
            port,
            ...(privateKey ? { privateKey } : { password }),
            tryKeyboard: true,
        });
        console.log('Connected!');

        const skipUpload = process.env.VPS_SKIP_UPLOAD === '1' || process.env.VPS_SKIP_UPLOAD === 'true';
        if (!skipUpload) {
            console.log('Uploading patched files...');
            for (const file of filesToUpload) {
                const localPath = path.join(__dirname, file.local);
                console.log(`Uploading ${localPath} -> ${file.remote}`);
                await ssh.putFile(localPath, file.remote);
            }
        } else {
            console.log('Skipping upload (VPS_SKIP_UPLOAD=1).');
        }

        console.log('Rebuilding Frontend on VPS...');
        const result = await ssh.execCommand('npm run build', {
            cwd: '/var/www/fatopago',
            onStdout: (chunk) => process.stdout.write(chunk.toString()),
            onStderr: (chunk) => process.stderr.write(chunk.toString())
        });

        if (result.code === 0) {
            console.log('Build Successful!');
        } else {
            console.error('Build Failed!');
        }

        ssh.dispose();

    } catch (error) {
        console.error('Patch Failed:', error);
        ssh.dispose();
    }
}

patchFrontend();
