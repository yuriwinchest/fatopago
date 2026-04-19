const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });

const admin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
);

const EMAIL = 'giovanagabrieligomes@gmail.com';
const USER_ID = '061e069a-54e2-4f2e-a2b7-9633e3c4f63c';

async function main() {
    console.log('=== Verificação pós-fix ===\n');

    // 1) Profile ainda presente
    const { data: profile } = await admin
        .from('profiles')
        .select('id, email, name, plan_status')
        .eq('id', USER_ID)
        .maybeSingle();
    console.log('Profile Giovana:', profile ? 'PRESENTE' : 'AUSENTE');
    if (profile) console.log('  ', profile);

    // 2) Contagem total profiles vs auth users
    const { count: profileCount } = await admin
        .from('profiles')
        .select('*', { count: 'exact', head: true });
    console.log(`\nTotal profiles: ${profileCount}`);

    const authList = [];
    let page = 1;
    while (true) {
        const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        authList.push(...data.users);
        if (data.users.length < 1000) break;
        page += 1;
    }
    console.log(`Total auth users: ${authList.length}`);
    const missing = authList.filter(
        (u) => !u.email?.startsWith('codex') && !u.email?.startsWith('pix.')
    );
    const { data: allProfiles } = await admin.from('profiles').select('id');
    const profileIds = new Set(allProfiles.map((p) => p.id));
    const stillMissing = authList.filter((u) => !profileIds.has(u.id));
    console.log(`Ainda sem profile: ${stillMissing.length}`);
    stillMissing.forEach((u) => console.log('  ', u.email));

    // 3) Simular submit_validation com token real da Giovana numa task não validada
    const { data: openTasks } = await admin
        .from('news_tasks')
        .select('id, content')
        .eq('consensus_status', 'open')
        .eq('consensus_reached', false)
        .order('created_at', { ascending: false })
        .limit(20);

    const { data: userValsNow } = await admin
        .from('validations')
        .select('task_id')
        .eq('user_id', USER_ID);
    const validatedIds = new Set(userValsNow.map((v) => v.task_id));

    const candidate = openTasks.find((t) => !validatedIds.has(t.id));
    if (!candidate) {
        console.log('\nNenhuma task aberta não validada por Giovana disponível para o teste.');
        return;
    }
    console.log(`\nTask candidata: ${candidate.id} — ${candidate.content?.title?.slice(0, 60)}`);

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email: EMAIL
    });
    if (linkErr) throw linkErr;

    const publicClient = createClient(
        process.env.VITE_SUPABASE_URL,
        process.env.VITE_SUPABASE_ANON_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { data: verifyData, error: verifyErr } = await publicClient.auth.verifyOtp({
        type: 'magiclink',
        token_hash: linkData.properties.hashed_token
    });
    if (verifyErr) throw verifyErr;
    console.log('Sessão de Giovana obtida. uid:', verifyData.user?.id);

    const { data: result, error } = await publicClient.rpc('submit_validation', {
        p_task_id: candidate.id,
        p_verdict: true,
        p_justification: null,
        p_proof_link: null,
        p_proof_image_url: null
    });
    console.log('\n>>> submit_validation resultado:');
    console.log('  data:', result);
    console.log('  error:', error);
}

main().catch((err) => {
    console.error('Erro:', err);
    process.exit(1);
});
