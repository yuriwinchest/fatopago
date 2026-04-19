
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

async function diagnose() {
  const { data: users, error } = await supabase.from('profiles').select('*').or('name.ilike.%noeli%,lastname.ilike.%alvarenga%');
  if (error) {
    console.error('Erro ao buscar usuários:', error);
    return;
  }
  
  if (!users || users.length === 0) {
    console.log('Nenhum usuário encontrado.');
    return;
  }

  for (const user of users) {
    console.log(`User: ${user.id}, ${user.name} ${user.lastname}, Email: ${user.email}, Plan Status: ${user.plan_status}`);
    
    const { data: plans, error: planErr } = await supabase.from('plan_purchases').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (planErr) console.error('  Erro ao buscar planos:', planErr);
    else {
      plans.forEach(plan => {
        console.log(`  Plan: ${plan.id}, Name: ${plan.plan_id}, Status: ${plan.status}, Validations: ${plan.used_validations}/${plan.max_validations}, Credit: ${plan.validation_credit_remaining}/${plan.validation_credit_total}`);
      });
    }

    const { data: vals, error: valErr } = await supabase.from('validations').select('id, created_at, task_id').eq('user_id', user.id);
    if (valErr) console.error('  Erro ao buscar validations:', valErr);
    else console.log(`  Validations count: ${vals.length}`);

    const { data: ledger, error: ledgerErr } = await supabase.from('financial_ledger').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20);
    if (ledgerErr) console.error('  Erro ao buscar ledger:', ledgerErr);
    else ledger.forEach(entry => {
      console.log(`  Ledger: ${entry.created_at}, Type: ${entry.entry_type}, Amt: ${entry.amount} ${entry.currency_code}, Desc: ${entry.description}`);
    });
  }
}
diagnose();
