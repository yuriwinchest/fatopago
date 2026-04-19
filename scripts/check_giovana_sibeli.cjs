const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });

const admin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function main() {
  // 1. Find Sibeli in sellers
  const { data: sellers } = await admin
    .from('sellers')
    .select('id, name, seller_code, email, phone')
    .ilike('name', '%sibeli%');
  console.log('=== VENDEDORAS COM NOME "SIBELI" ===');
  console.log(JSON.stringify(sellers, null, 2));

  // 2. Find Giovana
  const { data: giovana } = await admin
    .from('profiles')
    .select('id, email, name, cpf, affiliate_code, referral_code, created_at')
    .eq('email', 'giovanagabrieligomes@gmail.com')
    .single();
  console.log('\n=== PROFILE GIOVANA ===');
  console.log(JSON.stringify(giovana, null, 2));

  if (giovana) {
    // 3. Check seller_referrals for Giovana
    const { data: refs } = await admin
      .from('seller_referrals')
      .select('id, seller_id, affiliate_code, source, created_at')
      .eq('referred_user_id', giovana.id);
    console.log('\n=== SELLER_REFERRALS DA GIOVANA ===');
    console.log(JSON.stringify(refs, null, 2));

    // 4. Check plan_purchases
    const { data: plans } = await admin
      .from('plan_purchases')
      .select('id, plan_type, seller_id, status, created_at')
      .eq('user_id', giovana.id);
    console.log('\n=== PLAN_PURCHASES DA GIOVANA ===');
    console.log(JSON.stringify(plans, null, 2));

    // 5. Check auth metadata
    const { data: authUser } = await admin.auth.admin.getUserById(giovana.id);
    const meta = authUser?.user?.user_metadata || {};
    console.log('\n=== AUTH USER_METADATA ===');
    console.log('affiliate_code:', meta.affiliate_code || '(nenhum)');
    console.log('name:', meta.name || '(nenhum)');
    console.log('cpf:', meta.cpf || '(nenhum)');

    // 6. Funnel events for Giovana
    const { data: funnelEvents } = await admin
      .from('seller_funnel_events')
      .select('event_type, affiliate_code, created_at, user_id')
      .eq('user_id', giovana.id)
      .order('created_at', { ascending: true });
    console.log('\n=== FUNNEL EVENTS DA GIOVANA ===');
    console.log(JSON.stringify(funnelEvents, null, 2));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
