
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

const localTarPath = path.join(__dirname, '../app.tar');
const localScriptPath = path.join(__dirname, 'deploy_vps.sh');
const remoteTarPath = '/root/app.tar';
const remoteScriptPath = '/root/deploy_vps.sh';

async function deploy() {
    console.log(`Connecting to ${host}...`);
    try {
        if (!privateKey && !password) {
            throw new Error('Defina VPS_KEY_PATH (recomendado) ou VPS_PASSWORD no ambiente.');
        }

        await ssh.connect({
            host,
            username,
            port,
            ...(privateKey ? { privateKey } : { password }),
            tryKeyboard: true
        });
        console.log('Connected!');

        console.log('Uploading app.tar...');
        await ssh.putFile(localTarPath, remoteTarPath);
        console.log('app.tar uploaded.');

        console.log('Uploading deploy script...');
        await ssh.putFile(localScriptPath, remoteScriptPath);
        console.log('deploy_vps.sh uploaded.');

        console.log('Making script executable...');
        await ssh.execCommand(`chmod +x ${remoteScriptPath}`);

        console.log('Running deploy script (This may take a few minutes)...');
        // We use execCommand with stream option to show output in real-time if we wanted, 
        // but for simplicity we'll wait for it to finish and print result.
        // NOTE: The script runs apt-get update/upgrade which might be interactive if not handled.
        // My bash script uses DEBIAN_FRONTEND=noninteractive so it should be fine.

        const result = await ssh.execCommand(`./deploy_vps.sh`, {
            cwd: '/root',
            onStdout: (chunk) => process.stdout.write(chunk.toString()),
            onStderr: (chunk) => process.stderr.write(chunk.toString())
        });

        console.log('STDOUT:', result.stdout);
        console.log('STDERR:', result.stderr);

        if (result.code !== 0) {
            console.error(`Deploy script failed with code ${result.code}`);
        } else {
            console.log('Deployment script finished successfully!');
        }

        ssh.dispose();

    } catch (error) {
        console.error('Deployment Failed:', error);
        ssh.dispose();
    }
}

deploy();
