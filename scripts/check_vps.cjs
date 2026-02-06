const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const host = process.env.VPS_HOST;
if (!host) throw new Error('VPS_HOST environment variable is required');
const username = process.env.VPS_USER || 'root';
const password = process.env.VPS_PASSWORD;
const privateKey = process.env.VPS_KEY_PATH;
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

        console.log('\n🧩 Checando se o build contém chave pública Stripe (sem expor valor)...');
        const stripeInBuild = await ssh.execCommand(
            "python3 - <<'PY'\nfrom pathlib import Path\nimport glob\npaths=sorted(glob.glob('/var/www/fatopago/dist/assets/*.js'))\nif not paths:\n  print('dist_js=missing')\n  raise SystemExit(0)\nfound=False\nfor p in paths:\n  try:\n    if b'pk_' in Path(p).read_bytes():\n      found=True\n      break\n  except Exception:\n    pass\nprint('dist_js_has_pk=' + ('yes' if found else 'no'))\nPY"
        );
        console.log(stripeInBuild.stdout || stripeInBuild.stderr);

        console.log('\n🧩 Checando se o código em Plans.tsx referencia PaymentModal...');
        const plansUsesPaymentModal = await ssh.execCommand(
            "grep -n \"PaymentModal\" /var/www/fatopago/src/pages/Plans.tsx 2>/dev/null | head -n 10 || echo \"(não encontrado)\""
        );
        console.log(plansUsesPaymentModal.stdout || plansUsesPaymentModal.stderr);

        console.log('\n🔄 Verificando PM2...');
        const pm2Result = await ssh.execCommand('pm2 list');
        console.log(pm2Result.stdout);

        console.log('\n🔐 Checando variáveis Stripe no .env (sem expor valores)...');
        const envStripe = await ssh.execCommand(
            "grep -E '^(VITE_STRIPE_PUBLIC_KEY|STRIPE_SECRET_KEY)=' /var/www/fatopago/.env 2>/dev/null | sed 's/=.*$/=***set***/'"
        );
        console.log(envStripe.stdout || envStripe.stderr || '(não encontrado)');

        const envStripeKind = await ssh.execCommand(
            "python3 - <<'PY'\nfrom pathlib import Path\np=Path('/var/www/fatopago/.env')\ntext=p.read_text(errors='ignore').splitlines() if p.exists() else []\nvalues={}\nfor line in text:\n  if '=' not in line: continue\n  k,v=line.split('=',1)\n  if k in ('VITE_STRIPE_PUBLIC_KEY','STRIPE_SECRET_KEY'):\n    values[k]=v.strip()\n\ndef kind(v,prefixes):\n  for pr in prefixes:\n    if v.startswith(pr):\n      return pr\n  return 'other' if v else 'missing'\n\nprint('VITE_STRIPE_PUBLIC_KEY_kind=' + kind(values.get('VITE_STRIPE_PUBLIC_KEY',''), ['pk_live_','pk_test_']))\nprint('STRIPE_SECRET_KEY_kind=' + kind(values.get('STRIPE_SECRET_KEY',''), ['sk_live_','sk_test_']))\nPY"
        );
        console.log(envStripeKind.stdout || envStripeKind.stderr);

        console.log('\n🧾 Checando backend com PIX apenas...');
        const pixOnly = await ssh.execCommand("grep -n \"payment_method_types\" /var/www/fatopago/server/index.js 2>/dev/null || echo \"(não encontrado)\"");
        console.log(pixOnly.stdout || pixOnly.stderr);

        console.log('\n💳 Testando endpoint Stripe (PIX) sem imprimir clientSecret...');
        const stripeTest = await ssh.execCommand(
            "curl -sS -D - -o /tmp/fp_stripe_body.txt -X POST http://127.0.0.1:3000/api/create-payment-intent -H 'Content-Type: application/json' -d '{\"planId\":\"starter\"}' >/tmp/fp_stripe_headers.txt && python3 - <<'PY'\nfrom pathlib import Path\nimport json\nheaders=Path('/tmp/fp_stripe_headers.txt').read_text(errors='ignore').splitlines()\nstatus=next((h for h in headers if h.startswith('HTTP/')), 'HTTP/?')\nraw=Path('/tmp/fp_stripe_body.txt').read_text(errors='ignore').strip()\ntry:\n  data=json.loads(raw) if raw else {}\nexcept Exception:\n  print(status)\n  print('(resposta não-JSON)')\n  raise SystemExit(0)\nprint(status)\nif 'clientSecret' in data:\n  print('ok')\nelse:\n  print('erro', data.get('error','(sem mensagem)'))\nPY"
        );
        console.log(stripeTest.stdout || stripeTest.stderr);

        console.log('\n🧯 Últimos erros do PM2 (fatopago-api)...');
        const pm2Err = await ssh.execCommand("tail -n 30 /root/.pm2/logs/fatopago-api-error.log 2>/dev/null || tail -n 30 ~/.pm2/logs/fatopago-api-error.log 2>/dev/null || echo '(sem log)'");
        console.log(pm2Err.stdout || pm2Err.stderr);

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
