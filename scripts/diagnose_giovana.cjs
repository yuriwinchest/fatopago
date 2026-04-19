const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TARGET_EMAIL = 'giovanagabrieligomes@gmail.com';

async function diagnose() {
    console.log(`--- Diagnóstico para ${TARGET_EMAIL} ---\n`);

    // 1) Buscar em auth.users
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000
    });
    if (authError) {
        console.error('Erro ao listar usuários auth:', authError);
        return;
    }

    const authUser = authData.users.find(
        (u) => (u.email || '').toLowerCase() === TARGET_EMAIL.toLowerCase()
    );

    if (!authUser) {
        console.log('NÃO EXISTE em auth.users');
        return;
    }

    console.log('AUTH USER:');
    console.log('  id:', authUser.id);
    console.log('  email:', authUser.email);
    console.log('  created_at:', authUser.created_at);
    console.log('  email_confirmed_at:', authUser.email_confirmed_at);
    console.log('  last_sign_in_at:', authUser.last_sign_in_at);
    console.log('  user_metadata:', JSON.stringify(authUser.user_metadata, null, 2));

    // 2) Buscar em public.profiles
    const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

    if (profileError) {
        console.error('Erro ao buscar profile:', profileError);
    }

    console.log('\nPROFILE ROW:');
    if (!profile) {
        console.log('  AUSENTE (este é o motivo do erro "seu cadastro está sendo sincronizado")');
    } else {
        console.log(JSON.stringify(profile, null, 2));
    }

    // 3) Verificar plan_purchases
    const { data: plans, error: planError } = await supabaseAdmin
        .from('plan_purchases')
        .select('id, plan_id, status, used_validations, max_validations, validation_credit_remaining, started_at')
        .eq('user_id', authUser.id)
        .order('started_at', { ascending: false });

    if (planError) {
        console.error('Erro ao buscar plan_purchases:', planError);
    } else {
        console.log(`\nPLAN PURCHASES (${plans?.length || 0}):`);
        plans?.forEach((p) => console.log(' ', JSON.stringify(p)));
    }

    // 4) Verificar validations existentes
    const { data: vals, error: valError } = await supabaseAdmin
        .from('validations')
        .select('id, task_id, created_at, verdict')
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: false })
        .limit(5);
    if (valError) {
        console.error('Erro ao buscar validations:', valError);
    } else {
        console.log(`\nVALIDATIONS existentes (${vals?.length || 0}):`);
        vals?.forEach((v) => console.log(' ', JSON.stringify(v)));
    }
}

diagnose().catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
});
