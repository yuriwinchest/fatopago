
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

async function diagnose() {
  const { data: users, error } = await supabase.from('profiles').select('*').ilike('name', '%Noeli%');
  if (error) {
    console.error('Erro ao buscar Noeli:', error);
    return;
  }
  
  if (!users || users.length === 0) {
    console.log('Noeli não encontrada.');
    return;
  }
  
  const user = users[0];
  console.log('User Noeli:', user.id, user.name, user.lastname, 'Balance:', user.current_balance, 'Compensatory:', user.compensatory_credit_balance);
  
  const { data: plans, error: planErr } = await supabase.from('plan_purchases').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
  if (planErr) console.error('Erro ao buscar planos:', planErr);
  else console.log('Plans for Noeli:', plans);

  const { data: vals, error: valErr } = await supabase.from('validations').select('id, created_at, task_id').eq('user_id', user.id);
  if (valErr) console.error('Erro ao buscar validations:', valErr);
  else console.log('Validations for Noeli:', vals.length, vals);

  const { data: history, error: histErr } = await supabase.from('financial_ledger').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
  if (histErr) console.error('Erro ao buscar financial_ledger:', histErr);
  else console.log('History for Noeli (Ledger):', history);
}
diagnose();
