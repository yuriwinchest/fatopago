
const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
const path = require('path');

// VPS Credentials
const host = '72.60.53.191';
const username = 'root';
const password = 'Horapiaui@2026';

const filesToUpload = [
    { local: '../index.html', remote: '/var/www/fatopago/index.html' },
    { local: '../src/main.tsx', remote: '/var/www/fatopago/src/main.tsx' },
    { local: '../src/components/ErrorBoundary.tsx', remote: '/var/www/fatopago/src/components/ErrorBoundary.tsx' }
];

async function patchFrontend() {
    console.log(`Connecting to ${host}...`);
    try {
        await ssh.connect({
            host,
            username,
            password,
            tryKeyboard: true,
        });
        console.log('Connected!');

        console.log('Uploading patched files...');
        for (const file of filesToUpload) {
            const localPath = path.join(__dirname, file.local);
            console.log(`Uploading ${localPath} -> ${file.remote}`);
            await ssh.putFile(localPath, file.remote);
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
