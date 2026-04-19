/* eslint-disable @typescript-eslint/no-var-requires */

const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
const fs = require('fs');
const os = require('os');
const path = require('path');

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

if (!host) throw new Error('Defina VPS_HOST no ambiente.');
if (!privateKey && !password) {
    throw new Error('Defina VPS_KEY_PATH (recomendado) ou tenha a chave padrão em ~/.ssh/fatopago_key. Em último caso, use VPS_PASSWORD.');
}

const localScriptPath = path.join(__dirname, 'check_supabase_connection.cjs');
const remoteScriptPath = '/var/www/fatopago/scripts/check_supabase_connection.cjs';


async function verifyRemoteConnection() {
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

        console.log('Ensure scripts directory exists...');
        await ssh.execCommand('mkdir -p /var/www/fatopago/scripts');

        console.log('Uploading connection check script...');
        await ssh.putFile(localScriptPath, remoteScriptPath);

        // We need to install dotenv and @supabase/supabase-js on the VPS if not already there
        // Although we did 'npm install' during deploy, let's make sure.
        console.log('Installing dependencies for script if missing...');
        await ssh.execCommand('npm install dotenv @supabase/supabase-js', { cwd: '/var/www/fatopago' });

        console.log('Running connection check on VPS...');
        const result = await ssh.execCommand(`node scripts/check_supabase_connection.cjs`, {
            cwd: '/var/www/fatopago',
            onStdout: (chunk) => process.stdout.write(chunk.toString()),
            onStderr: (chunk) => process.stderr.write(chunk.toString())
        });

        if (result.code === 0) {
            console.log('\n✅ VPS -> Database Connection CONFIRMED.');
        } else {
            console.error('\n❌ VPS -> Database Connection FAILED.');
        }

        ssh.dispose();

    } catch (error) {
        console.error('Remote Verification Failed:', error);
        ssh.dispose();
    }
}

verifyRemoteConnection();
