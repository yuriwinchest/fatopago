
const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
const path = require('path');

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
const localSrc = path.join(__dirname, '../src');
const remoteSrc = `${appDir}/src`;

async function deployUpdate() {
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

        console.log('Uploading updated source code...');
        // Upload entire src directory recursively
        await ssh.putDirectory(localSrc, remoteSrc, {
            recursive: true,
            concurrency: 10,
            validate: (itemPath) => {
                const baseName = path.basename(itemPath);
                return baseName !== 'node_modules' && !baseName.startsWith('.');
            }
        });

        console.log('Uploading public directory...');
        const localPublic = path.join(__dirname, '../public');
        const remotePublic = `${appDir}/public`;
        await ssh.putDirectory(localPublic, remotePublic, {
            recursive: true,
            concurrency: 10
        });
        console.log('Assets uploaded.');

        console.log('Rebuilding Application...');
        const result = await ssh.execCommand('npm run build', {
            cwd: appDir,
            onStdout: (chunk) => process.stdout.write(chunk.toString()),
            onStderr: (chunk) => process.stderr.write(chunk.toString())
        });

        if (result.code === 0) {
            console.log('\n✅ Update Deployed Successfully!');
            console.log('Restarting fatopago service...');
            try {
                const restart = await ssh.execCommand('pm2 restart fatopago');
                console.log(restart.stdout);
                console.log(restart.stderr);
            } catch (err) {
                console.error('Restart failed:', err);
            }
        } else {
            console.error('\n❌ Build Failed.');
        }

        ssh.dispose();

    } catch (error) {
        console.error('Deploy Failed:', error);
        ssh.dispose();
    }
}

deployUpdate();
