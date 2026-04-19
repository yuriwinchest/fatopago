const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });

const admin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function main() {
  // 1. Find seller by the code from Giovana's metadata
  const { data: sellerByCode } = await admin
    .from('sellers')
    .select('id, name, seller_code, email, phone')
    .eq('seller_code', 'VNDFAEED87E')
    .single();
  console.log('=== VENDEDOR(A) COM CÓDIGO VNDFAEED87E ===');
  console.log(JSON.stringify(sellerByCode, null, 2));

  // 2. Search for "21741010" — could be phone, seller id, etc.
  const { data: byPhone } = await admin
    .from('sellers')
    .select('id, name, seller_code, email, phone')
    .ilike('phone', '%21741010%');
  console.log('\n=== SELLERS COM PHONE ~21741010~ ===');
  console.log(JSON.stringify(byPhone, null, 2));

  // Also check if it's a CPF fragment
  const { data: byCpf } = await admin
    .from('profiles')
    .select('id, email, name, cpf')
    .ilike('cpf', '%21741010%');
  console.log('\n=== PROFILES COM CPF ~21741010~ ===');
  console.log(JSON.stringify(byCpf, null, 2));

  // Also search seller names for sibeli/sybeli/cibeli
  const { data: byName1 } = await admin.from('sellers').select('id, name, seller_code, email, phone').ilike('name', '%sibel%');
  const { data: byName2 } = await admin.from('sellers').select('id, name, seller_code, email, phone').ilike('name', '%cybel%');
  const { data: byName3 } = await admin.from('sellers').select('id, name, seller_code, email, phone').ilike('name', '%cibel%');
  const { data: byName4 } = await admin.from('sellers').select('id, name, seller_code, email, phone').ilike('name', '%sybel%');
  const allByName = [...(byName1||[]), ...(byName2||[]), ...(byName3||[]), ...(byName4||[])];
  console.log('\n=== SELLERS COM NOME PARECIDO COM SIBELI ===');
  console.log(JSON.stringify(allByName, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
