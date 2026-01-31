/* eslint-disable @typescript-eslint/no-var-requires */

const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
const path = require('path');

// VPS Credentials
const host = '72.60.53.191';
const username = 'root';
const password = 'Horapiaui@2026';

const localScriptPath = path.join(__dirname, 'check_supabase_connection.cjs');
const remoteScriptPath = '/var/www/fatopago/scripts/check_supabase_connection.cjs';


async function verifyRemoteConnection() {
    console.log(`Connecting to ${host}...`);
    try {
        await ssh.connect({
            host,
            username,
            password,
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
