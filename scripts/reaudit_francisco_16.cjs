const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });

const admin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
);

const FRANCISCO_CODE = 'VND09E38DAB';

async function main() {
    console.log('=== REAUDITORIA COMPLETA — Francisco Alberto ===\n');

    // 1. Pegar o id do Francisco
    const { data: francisco } = await admin
        .from('sellers')
        .select('id, name, seller_code')
        .eq('seller_code', FRANCISCO_CODE)
        .single();
    console.log('Vendedor:', francisco);

    // 2. Todas as seller_referrals dele, em ordem cronológica
    const { data: allRefs } = await admin
        .from('seller_referrals')
        .select('id, referred_user_id, affiliate_code, source, created_at, campaign_enabled_by')
        .eq('seller_id', francisco.id)
        .order('created_at', { ascending: true });
    console.log(`\nTotal de seller_referrals atribuidas ao Francisco: ${allRefs.length}`);

    // Histograma por dia
    const byDay = {};
    allRefs.forEach((r) => {
        const day = r.created_at.slice(0, 10);
        byDay[day] = (byDay[day] || 0) + 1;
    });
    console.log('\nDistribuicao por dia:');
    Object.entries(byDay).sort().forEach(([d, c]) => console.log(`  ${d}: ${c}`));

    // 3. Agrupar por segundo — detecta inserts em lote
    const bySecond = {};
    allRefs.forEach((r) => {
        const sec = r.created_at.slice(0, 19);
        bySecond[sec] = (bySecond[sec] || []);
        bySecond[sec].push(r);
    });
    const batches = Object.entries(bySecond).filter(([, arr]) => arr.length >= 2);
    console.log(`\nTimestamps com >=2 inserts no mesmo segundo (indicio de batch):`);
    batches.forEach(([ts, arr]) => console.log(`  ${ts} -> ${arr.length} inserts`));

    // 4. Quais referrals nao batem com profiles.affiliate_code?
    const refIds = allRefs.map((r) => r.referred_user_id);
    const { data: profiles } = await admin
        .from('profiles')
        .select('id, email, name, affiliate_code, created_at')
        .in('id', refIds);
    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    const mismatched = allRefs.filter((r) => {
        const p = profileMap.get(r.referred_user_id);
        return !p || p.affiliate_code !== FRANCISCO_CODE;
    });
    console.log(`\nReferrals onde profile.affiliate_code != ${FRANCISCO_CODE}: ${mismatched.length}`);

    // 5. Para cada um desses, checar: auth metadata, clicks/visits, timeline
    console.log('\n--- Detalhamento de cada caso divergente ---');
    for (const r of mismatched) {
        const p = profileMap.get(r.referred_user_id);
        const { data: authUser } = await admin.auth.admin.getUserById(r.referred_user_id);
        const meta = authUser?.user?.user_metadata || {};

        // eventos de funil com codigo do Francisco para este anon_id OU user_id
        const { data: funnelEvents } = await admin
            .from('seller_funnel_events')
            .select('event_type, affiliate_code, created_at, user_id, anon_id, metadata')
            .eq('affiliate_code', FRANCISCO_CODE)
            .or(`user_id.eq.${r.referred_user_id}`)
            .order('created_at', { ascending: true });

        console.log('\n================');
        console.log('Email:', p?.email);
        console.log('Nome:', p?.name);
        console.log('User ID:', r.referred_user_id);
        console.log('Profile created_at:', p?.created_at);
        console.log('Profile.affiliate_code atual:', p?.affiliate_code);
        console.log('Seller_referral created_at:', r.created_at);
        console.log('Seller_referral source:', r.source);
        console.log('Seller_referral campaign_enabled_by:', r.campaign_enabled_by);
        console.log('auth.user_metadata.affiliate_code:', meta.affiliate_code || '(nenhum)');
        console.log('auth.created_at:', authUser?.user?.created_at);

        console.log(`Eventos de funil deste user_id com codigo Francisco: ${funnelEvents?.length || 0}`);
        funnelEvents?.forEach((e) => {
            console.log(`  ${e.created_at} ${e.event_type}`);
        });

        // Eventos de funil POR ANON antes do cadastro (se houver anon_id no metadata)
        // Nao temos anon_id para correlacionar, entao vamos so checar se houve
        // algum click/visit com o codigo do Francisco antes do timestamp de criacao do profile
        const { data: preRegEvents } = await admin
            .from('seller_funnel_events')
            .select('event_type, created_at, anon_id')
            .eq('affiliate_code', FRANCISCO_CODE)
            .in('event_type', ['link_click', 'invite_visit'])
            .lt('created_at', p?.created_at)
            .order('created_at', { ascending: true });
        console.log(`Total de clicks/visits com codigo Francisco ANTES de ${p?.created_at}: ${preRegEvents?.length || 0}`);
    }
}

main().catch((e) => { console.error(e); process.exit(1); });
