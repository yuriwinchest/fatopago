
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

async function diagnose() {
  const { data: profileData, error: profileErr } = await supabase.from('profiles').select('*').limit(1);
  if (profileErr) console.error('Erro ao ler profiles:', profileErr);
  else console.log('profiles columns:', profileData && profileData.length > 0 ? Object.keys(profileData[0]) : 'Vazia');

  const { data: transData, error: transErr } = await supabase.from('financial_ledger').select('*').limit(1);
  if (transErr) console.error('Erro ao ler financial_ledger:', transErr);
  else console.log('financial_ledger columns:', transData && transData.length > 0 ? Object.keys(transData[0]) : 'Vazia');

  const { data: valData, error: valErr } = await supabase.from('submitted_validations').select('*').limit(1);
  if (valErr) console.error('Erro ao ler submitted_validations:', valErr);
  else console.log('submitted_validations columns:', valData && valData.length > 0 ? Object.keys(valData[0]) : 'Vazia');
}
diagnose();
