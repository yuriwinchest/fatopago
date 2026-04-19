const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
);

async function main() {
    console.log('--- Verificando usuários auth sem profile ---\n');

    let page = 1;
    const perPage = 1000;
    const authUsers = [];
    while (true) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
        if (error) throw error;
        authUsers.push(...data.users);
        if (data.users.length < perPage) break;
        page += 1;
    }
    console.log(`Total de usuários auth: ${authUsers.length}`);

    const { data: profiles, error: pErr } = await supabaseAdmin
        .from('profiles')
        .select('id');
    if (pErr) throw pErr;

    const profileIds = new Set(profiles.map((p) => p.id));
    const missing = authUsers.filter((u) => !profileIds.has(u.id));

    console.log(`Profiles existentes: ${profiles.length}`);
    console.log(`AUSENTES: ${missing.length}\n`);

    if (missing.length === 0) {
        console.log('OK - nenhum usuário sem profile.');
        return;
    }

    missing.forEach((u) => {
        console.log(` - ${u.email} (${u.id}) criado em ${u.created_at}`);
    });

    // Agora backfilling
    console.log('\n--- Backfilling perfis ausentes ---');
    let created = 0;
    let failed = 0;
    for (const u of missing) {
        const meta = u.user_metadata || {};
        const payload = {
            id: u.id,
            name: (meta.name || u.email.split('@')[0] || 'Usuário').trim(),
            lastname: (meta.lastname || '').trim(),
            city: (meta.city || '').trim(),
            state: (meta.state || '').trim(),
            email: u.email,
            phone: (meta.phone || '').replace(/\D/g, '') || null,
            cpf: meta.cpf ? String(meta.cpf).replace(/\D/g, '') : null,
            birth_date: meta.birth_date || null,
            avatar_url: meta.avatar_url || null,
            affiliate_code: meta.affiliate_code || null,
            reputation_score: 0,
            current_balance: 0,
            compensatory_credit_balance: 0,
            is_active: true,
            plan_status: 'none',
            created_at: u.created_at,
            updated_at: new Date().toISOString()
        };

        const { error: insErr } = await supabaseAdmin
            .from('profiles')
            .upsert(payload, { onConflict: 'id' });
        if (insErr) {
            console.log(` FALHA ${u.email}: ${insErr.message}`);
            failed += 1;
        } else {
            console.log(` OK ${u.email}`);
            created += 1;
        }
    }
    console.log(`\nBackfill completo. criados=${created} falhas=${failed}`);
}

main().catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
});
