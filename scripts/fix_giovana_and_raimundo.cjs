const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });

const admin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const GIOVANA_ID = '061e069a-54e2-4f2e-a2b7-9633e3c4f63c';
const CIBELLE_SELLER_ID = 'e458da13-aaf9-4a13-b546-03d46bc6339a';
const CIBELLE_CODE = 'VNDFAEED87E';

const RAIMUNDO_ID = 'e561b19b-96af-4e65-83c2-ea7c46f1401e';
const FRANCISCO_CODE = 'VND09E38DAB';

async function main() {
  console.log('=== FIX 1: GIOVANA — Sync profile from auth metadata ===\n');

  // 1a. Update Giovana's profile with correct data from auth metadata
  const { data: gUpdate, error: gErr } = await admin
    .from('profiles')
    .update({
      name: 'Geovana gabrieli',
      cpf: '07825655303',
      affiliate_code: CIBELLE_CODE
    })
    .eq('id', GIOVANA_ID)
    .select('id, email, name, cpf, affiliate_code');

  if (gErr) {
    console.error('ERRO ao atualizar profile Giovana:', gErr);
  } else {
    console.log('Profile Giovana atualizado:', JSON.stringify(gUpdate, null, 2));
  }

  // 1b. Create seller_referral linking Giovana -> Cibelle Lima
  const { data: existingRef } = await admin
    .from('seller_referrals')
    .select('id')
    .eq('referred_user_id', GIOVANA_ID)
    .single();

  if (existingRef) {
    console.log('seller_referral já existe para Giovana, pulando insert.');
  } else {
    const { data: refInsert, error: refErr } = await admin
      .from('seller_referrals')
      .insert({
        seller_id: CIBELLE_SELLER_ID,
        referred_user_id: GIOVANA_ID,
        affiliate_code: CIBELLE_CODE,
        source: 'link'
      })
      .select('id, seller_id, referred_user_id, affiliate_code, source, created_at');

    if (refErr) {
      console.error('ERRO ao criar seller_referral:', refErr);
    } else {
      console.log('seller_referral criada:', JSON.stringify(refInsert, null, 2));
    }
  }

  console.log('\n=== FIX 2: RAIMUNDOSILVA — Sync affiliate_code ===\n');

  const { data: rUpdate, error: rErr } = await admin
    .from('profiles')
    .update({ affiliate_code: FRANCISCO_CODE })
    .eq('id', RAIMUNDO_ID)
    .select('id, email, name, affiliate_code');

  if (rErr) {
    console.error('ERRO ao atualizar profile Raimundo:', rErr);
  } else {
    console.log('Profile Raimundo atualizado:', JSON.stringify(rUpdate, null, 2));
  }

  // === VERIFICAÇÃO FINAL ===
  console.log('\n=== VERIFICAÇÃO FINAL ===\n');

  const { data: gFinal } = await admin
    .from('profiles')
    .select('id, email, name, cpf, affiliate_code')
    .eq('id', GIOVANA_ID)
    .single();
  console.log('Giovana final:', JSON.stringify(gFinal, null, 2));

  const { data: gRef } = await admin
    .from('seller_referrals')
    .select('id, seller_id, affiliate_code, source, created_at')
    .eq('referred_user_id', GIOVANA_ID);
  console.log('Giovana seller_referrals:', JSON.stringify(gRef, null, 2));

  const { data: rFinal } = await admin
    .from('profiles')
    .select('id, email, name, affiliate_code')
    .eq('id', RAIMUNDO_ID)
    .single();
  console.log('Raimundo final:', JSON.stringify(rFinal, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
