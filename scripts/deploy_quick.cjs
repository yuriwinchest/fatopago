const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
const path = require('path');
const fs = require('fs');

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
const localDist = path.join(__dirname, '../dist');
const remoteDist = `${appDir}/dist`;
const localScripts = path.join(__dirname, '..', 'scripts');
const remoteScripts = `${appDir}/scripts`;

async function deployUpdate() {
    console.log(`Checking local build at ${localDist}...`);
    if (!fs.existsSync(localDist)) {
        throw new Error('Pasta dist não encontrada. Execute "npm run build" antes do deploy.');
    }

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

        console.log('Cleaning remote dist folder...');
        await ssh.execCommand(`rm -rf ${remoteDist}`);
        await ssh.execCommand(`mkdir -p ${remoteDist}`);

        console.log('Uploading local build (dist) to VPS...');
        await ssh.putDirectory(localDist, remoteDist, {
            recursive: true,
            concurrency: 10
        });

        console.log('Build uploaded to VPS.');

        console.log('Uploading required scripts to VPS...');
        try {
            await ssh.execCommand(`mkdir -p ${remoteScripts}`);
            await ssh.putFile(path.join(localScripts, 'news_ingest.cjs'), `${remoteScripts}/news_ingest.cjs`);
            await ssh.putFile(path.join(localScripts, 'live_news_worker.cjs'), `${remoteScripts}/live_news_worker.cjs`);
        } catch (err) {
            console.error('Script upload failed:', err);
        }

        // Optional: Update package.json/etc if needed for PM2 behavior, 
        // but for static files, dist is usually enough.
        console.log('Uploading root package.json for PM2 references...');
        try {
            await ssh.putFile(path.join(__dirname, '../package.json'), `${appDir}/package.json`);
        } catch (err) { }

        console.log('\n✅ Update Deployed Successfully!');
        console.log('Restarting fatopago service (PM2)...');
        try {
            // Some setups use PM2 to serve the dist folder or run a node server
            const restart = await ssh.execCommand('pm2 restart fatopago || pm2 start "npx serve -s dist" --name fatopago', { cwd: appDir });
            console.log(restart.stdout || 'Service restarted');
        } catch (err) {
            console.error('Restart failed:', err);
        }

        // Restart or start news worker (polls RSS every minute)
        try {
            await ssh.execCommand('pm2 restart fatopago-news || pm2 start "node scripts/live_news_worker.cjs" --name fatopago-news --time', { cwd: appDir });
        } catch (err) {
            // ignore
        }

        ssh.dispose();

    } catch (error) {
        console.error('Deploy Failed:', error);
        ssh.dispose();
    }
}

deployUpdate();
