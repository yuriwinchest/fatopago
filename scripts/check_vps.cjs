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

async function checkVPS() {
    try {
        console.log('Conectando na VPS...');
        await ssh.connect({
            host,
            username,
            port,
            ...(privateKey ? { privateKey } : { password }),
            tryKeyboard: true,
            readyTimeout: 30000
        });

        console.log('\n📁 Verificando arquivos no dist...');
        const lsResult = await ssh.execCommand('ls -lah /var/www/fatopago/dist/assets/ | tail -5');
        console.log(lsResult.stdout);

        console.log('\n🔍 Verificando data de modificação...');
        const dateResult = await ssh.execCommand('stat -c "%y" /var/www/fatopago/dist/assets/index-*.js');
        console.log(dateResult.stdout);

        console.log('\n🧩 Checando se o build contém integração Mercado Pago (sem expor credenciais)...');
        const mpInBuild = await ssh.execCommand(
            "js=$(ls -1 /var/www/fatopago/dist/assets/index-*.js 2>/dev/null | head -n 1); " +
            "if [ -z \"$js\" ]; then echo 'dist_js=missing'; exit 0; fi; " +
            "for s in mercadopago-create-pix mercadopago-check-payment mercadopago-pix-withdraw; do " +
            "if grep -a -q \"$s\" \"$js\"; then echo \"$s=found\"; else echo \"$s=missing\"; fi; " +
            "done"
        );
        console.log(mpInBuild.stdout || mpInBuild.stderr);

        console.log('\n🧩 Checando se o código em Plans.tsx referencia PixPaymentModal...');
        const plansUsesPixModal = await ssh.execCommand(
            "grep -n \"PixPaymentModal\" /var/www/fatopago/src/pages/Plans.tsx 2>/dev/null | head -n 10 || echo \"(não encontrado)\""
        );
        console.log(plansUsesPixModal.stdout || plansUsesPixModal.stderr);

        console.log('\n🔄 Verificando PM2...');
        const pm2Result = await ssh.execCommand('pm2 list');
        console.log(pm2Result.stdout);

        console.log('\n🧪 Checando se as Edge Functions do Mercado Pago estão publicadas...');
        const fnStatus = await ssh.execCommand(
            "set -a; . /var/www/fatopago/.env 2>/dev/null || true; set +a; " +
            "URL=${SUPABASE_URL:-$VITE_SUPABASE_URL}; " +
            "if [ -z \"$URL\" ]; then echo 'SUPABASE_URL=missing'; exit 0; fi; " +
            "for fn in mercadopago-create-pix mercadopago-check-payment mercadopago-pix-withdraw mercadopago-webhook; do " +
            "code=$(curl -sS -o /dev/null -w \"%{http_code}\" -X OPTIONS \"$URL/functions/v1/$fn\" || echo '000'); " +
            "echo ${fn}:${code}; " +
            "done"
        );
        console.log(fnStatus.stdout || fnStatus.stderr);

        console.log('\n🌐 Verificando Nginx...');
        const nginxProxy = await ssh.execCommand("grep -n \"location /api\" -n /etc/nginx/conf.d/*.conf 2>/dev/null | head -n 20");
        if (nginxProxy.stdout) console.log(nginxProxy.stdout);
        const nginxResult = await ssh.execCommand('nginx -t && systemctl status nginx | head -10');
        console.log(nginxResult.stdout || nginxResult.stderr);

        ssh.dispose();
    } catch (error) {
        console.error('❌ Erro:', error);
        ssh.dispose();
        process.exit(1);
    }
}

checkVPS();
