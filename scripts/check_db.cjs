const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadDotEnvIfPresent(filePath) {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const eqIndex = line.indexOf('=');
        if (eqIndex === -1) continue;
        const key = line.slice(0, eqIndex).trim();
        let value = line.slice(eqIndex + 1).trim();
        if (!key) continue;

        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }

        if (process.env[key] == null || process.env[key] === '') {
            process.env[key] = value;
        }
    }
}

async function countRows(supabase, table) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) return { table, count: null, error: error.message };
    return { table, count, error: null };
}

async function deleteAllRows(supabase, table) {
    const filters = [
        { column: 'id', op: 'not', args: ['id', 'is', null] },
        { column: 'created_at', op: 'not', args: ['created_at', 'is', null] },
        { column: 'user_id', op: 'not', args: ['user_id', 'is', null] },
        { column: 'task_id', op: 'not', args: ['task_id', 'is', null] },
        { column: 'referrer_id', op: 'not', args: ['referrer_id', 'is', null] },
        { column: 'referred_id', op: 'not', args: ['referred_id', 'is', null] },
    ];

    let lastError = null;

    for (const f of filters) {
        // Supabase exige filtro para delete; tentamos colunas comuns.
        // Se a coluna não existir, tentamos a próxima.
        const { error } = await supabase.from(table).delete().not(f.args[0], f.args[1], f.args[2]);
        if (!error) return { table, ok: true, error: null };

        const msg = error.message || '';
        if (msg.includes('does not exist') || msg.includes('column') || msg.includes('42703')) {
            lastError = msg;
            continue;
        }

        return { table, ok: false, error: msg };
    }

    return { table, ok: false, error: lastError || 'Não foi possível deletar: nenhuma coluna de filtro conhecida.' };
}

async function wipeAllUsers(supabase) {
    let deleted = 0;
    let page = 1;
    const perPage = 200;

    while (true) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
        if (error) throw new Error(`Falha ao listar usuários: ${error.message}`);
        const users = (data && data.users) || [];
        if (users.length === 0) break;

        for (const user of users) {
            const res = await supabase.auth.admin.deleteUser(user.id);
            if (res.error) {
                throw new Error(`Falha ao deletar usuário ${user.id}: ${res.error.message}`);
            }
            deleted += 1;
        }
        page += 1;
    }

    return deleted;
}

async function wipeDatabase() {
    const args = process.argv.slice(2);
    if (!args.includes('--yes')) {
        console.log('Operação destrutiva. Para LIMPAR TUDO, execute: node scripts/check_db.cjs --yes');
        process.exit(1);
    }

    const envPaths = [
        path.join(__dirname, '../.env.local'),
        path.join(__dirname, '../.env')
    ];
    for (const p of envPaths) loadDotEnvIfPresent(p);

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        console.error('Credenciais ausentes. Defina SUPABASE_URL (ou VITE_SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY.');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });

    const tablesToWipeInOrder = [
        'validations',
        'transactions',
        'commissions',
        'referrals',
        'plan_purchases',
        'profiles',
        'news_tasks'
    ];

    console.log('Contando linhas (antes)...');
    for (const table of tablesToWipeInOrder) {
        const res = await countRows(supabase, table);
        console.log(`- ${table}:`, res.error ? `erro (${res.error})` : res.count);
    }

    console.log('\nLimpando tabelas...');
    for (const table of tablesToWipeInOrder) {
        const res = await deleteAllRows(supabase, table);
        console.log(`- ${table}:`, res.ok ? 'ok' : `erro (${res.error})`);
    }

    console.log('\nDeletando todos os usuários (auth.users)...');
    const deletedUsers = await wipeAllUsers(supabase);
    console.log(`- usuários deletados: ${deletedUsers}`);

    console.log('\nContando linhas (depois)...');
    for (const table of tablesToWipeInOrder) {
        const res = await countRows(supabase, table);
        console.log(`- ${table}:`, res.error ? `erro (${res.error})` : res.count);
    }
}

wipeDatabase().catch((err) => {
    console.error('Falha ao limpar o banco:', err?.message || err);
    process.exit(1);
});
