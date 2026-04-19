const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

function pick(...vals) {
    for (const v of vals) {
        if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return '';
}

function deriveProjectRefFromUrl(url) {
    try {
        const u = new URL(url);
        // https://<ref>.supabase.co
        const host = String(u.host || '');
        const m = host.match(/^([a-z0-9]+)\\.supabase\\.co$/i);
        return m ? m[1] : '';
    } catch {
        return '';
    }
}

function run(cmd, args) {
    const r = spawnSync(cmd, args, {
        stdio: 'inherit',
        env: { ...process.env },
        shell: process.platform === 'win32',
    });
    if (r.status !== 0) {
        throw new Error(`Command failed (${r.status}): ${cmd} ${args.join(' ')}`);
    }
}

async function main() {
    // Primary path: use Supabase CLI migrations (recommended).
    const dbPassword = pick(process.env.SUPABASE_DB_PASSWORD);

    // Fallback: print SQL for manual execution.
    const sqlPath = path.join(__dirname, '../supabase/migrations/20260214190000_delete_account_rpc.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    if (!dbPassword) {
        console.error('[erro] SUPABASE_DB_PASSWORD não está definido (senha do banco).');
        console.error('[acao] Opções:');
        console.error('  1) Defina SUPABASE_DB_PASSWORD e rode: supabase db push');
        console.error('  2) Rode manualmente no Supabase SQL Editor o SQL abaixo.\n');
        console.log(sql);
        process.exit(1);
    }

    // Ensure project is linked (best effort). `supabase/.temp/project-ref` is created by `supabase link`.
    const supabaseUrl = pick(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_URL);
    const refFile = path.join(__dirname, '../supabase/.temp/project-ref');
    const alreadyLinked = fs.existsSync(refFile) && String(fs.readFileSync(refFile, 'utf8') || '').trim();

    const projectRef = pick(
        process.env.SUPABASE_PROJECT_REF,
        alreadyLinked ? String(fs.readFileSync(refFile, 'utf8') || '').trim() : '',
        deriveProjectRefFromUrl(supabaseUrl),
    );

    if (!alreadyLinked && projectRef) {
        // Avoid interactive prompts by providing password.
        run('supabase', ['link', '--project-ref', projectRef, '--password', dbPassword]);
    }

    run('supabase', ['db', 'push', '--password', dbPassword]);
    console.log('\n[ok] Migrations aplicadas no remoto. delete_own_account deve estar disponível.');
}

main().catch((err) => {
    console.error('apply_rpc_migration falhou:', err?.message || err);
    process.exit(1);
});
