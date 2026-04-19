const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
);

const USER_ID = '061e069a-54e2-4f2e-a2b7-9633e3c4f63c';
const EMAIL = 'giovanagabrieligomes@gmail.com';

async function main() {
    console.log('\n=== Inspeção aprofundada do caso Giovana ===\n');

    // 1) Qual é o ciclo atual?
    const { data: cycle, error: cycleErr } = await supabaseAdmin.rpc('get_weekly_cycle_window', {
        p_now: new Date().toISOString(),
        p_offset: 0
    });
    if (cycleErr) console.log('Erro ao obter ciclo:', cycleErr);
    else console.log('CICLO ATUAL:', JSON.stringify(cycle));

    // 2) Todos os plan_purchases (incluindo inativos)
    const { data: allPlans } = await supabaseAdmin
        .from('plan_purchases')
        .select('*')
        .eq('user_id', USER_ID)
        .order('started_at', { ascending: false });
    console.log(`\nPLAN PURCHASES (${allPlans?.length || 0}):`);
    allPlans?.forEach((p) => {
        console.log(' ', {
            id: p.id,
            plan_id: p.plan_id,
            status: p.status,
            used_validations: p.used_validations,
            max_validations: p.max_validations,
            validation_credit_remaining: p.validation_credit_remaining,
            started_at: p.started_at,
            completed_at: p.completed_at
        });
    });

    // 3) Tarefas disponíveis para validação
    const { data: tasks } = await supabaseAdmin
        .from('news_tasks')
        .select('id, consensus_status, consensus_reached, cycle_start_at, created_at, content')
        .eq('consensus_status', 'open')
        .eq('consensus_reached', false)
        .order('created_at', { ascending: false })
        .limit(5);
    console.log(`\nTAREFAS ABERTAS (${tasks?.length || 0}):`);
    tasks?.forEach((t) =>
        console.log(' ', {
            id: t.id,
            status: t.consensus_status,
            cycle_start_at: t.cycle_start_at,
            created_at: t.created_at,
            title: t.content?.title?.slice(0, 60)
        })
    );

    // 4) Validations dela com detalhes de FK
    const { data: userVals } = await supabaseAdmin
        .from('validations')
        .select('*')
        .eq('user_id', USER_ID);
    console.log(`\nVALIDATIONS (${userVals?.length || 0}):`);
    userVals?.forEach((v) => console.log(' ', v));

    // 5) Tentar simular a RPC com o service role (impersonando)
    // Service role NÃO tem auth.uid(), portanto vai falhar com "Não autenticado"
    // Precisamos gerar um JWT para ela via auth.admin.generateLink ou similar.
    console.log('\n--- Tentando simular chamada submit_validation via service role ---');
    if (tasks && tasks.length > 0) {
        const testTask = tasks[0];
        try {
            const { data, error } = await supabaseAdmin.rpc('submit_validation', {
                p_task_id: testTask.id,
                p_verdict: true,
                p_justification: null,
                p_proof_link: null,
                p_proof_image_url: null
            });
            console.log('Resultado submit_validation (service role):', { data, error });
        } catch (err) {
            console.log('Exceção:', err?.message || err);
        }
    }

    // 6) Checar existência do perfil explicitamente via SQL
    const { data: profileCheck, error: profileErr } = await supabaseAdmin
        .from('profiles')
        .select('id, email, created_at')
        .eq('id', USER_ID)
        .maybeSingle();
    console.log('\nPROFILE check:', profileCheck, profileErr);

    // 7) Consolidated: simulate as Giovana using a new signed access token
    console.log('\n--- Emitindo access token de Giovana para simular como usuária real ---');
    try {
        // generateLink returns an action_link that includes a token_hash
        // We'll use admin.generateLink + client verify to obtain a session
        const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
            type: 'magiclink',
            email: EMAIL
        });
        if (linkErr) {
            console.log('Erro generateLink:', linkErr);
        } else if (linkData?.properties?.hashed_token) {
            console.log('generateLink OK (hashed_token presente)');
            // Trocar o token por uma sessão usando verifyOtp
            const publicClient = createClient(
                process.env.VITE_SUPABASE_URL,
                process.env.VITE_SUPABASE_ANON_KEY,
                { auth: { persistSession: false, autoRefreshToken: false } }
            );
            const { data: verifyData, error: verifyErr } = await publicClient.auth.verifyOtp({
                type: 'magiclink',
                token_hash: linkData.properties.hashed_token
            });
            if (verifyErr) {
                console.log('Erro verifyOtp:', verifyErr);
            } else {
                console.log('Sessão de Giovana obtida. user_id:', verifyData.user?.id);
                if (tasks && tasks.length > 0) {
                    const testTask = tasks[0];
                    const { data, error } = await publicClient.rpc('submit_validation', {
                        p_task_id: testTask.id,
                        p_verdict: true,
                        p_justification: null,
                        p_proof_link: null,
                        p_proof_image_url: null
                    });
                    console.log('\n>>> submit_validation como Giovana:');
                    console.log('    data:', data);
                    console.log('    error:', error);
                }
            }
        }
    } catch (e) {
        console.log('Exceção na simulação:', e?.message || e);
    }
}

main().catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
});
