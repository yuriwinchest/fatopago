
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.log('Sem credenciais');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixStuckPlansOnly() {
  console.log('--- Corrigindo planos travados (v2) ---');

  const { data: exhaustedPlans, error } = await supabase
    .from('plan_purchases')
    .select('*')
    .eq('status', 'active');

  if (error) {
    console.error('Erro:', error);
    return;
  }

  let fixed = 0;
  for (const plan of exhaustedPlans) {
    if (plan.used_validations >= plan.max_validations) {
      console.log(`Fechando plano ID ${plan.id} (User ${plan.user_id})`);
      await supabase
        .from('plan_purchases')
        .update({ 
            status: 'completed', 
            completed_at: new Date().toISOString()
        })
        .eq('id', plan.id);
      fixed++;
    }
  }
  console.log(`Total corrigidos: ${fixed}`);
}

fixStuckPlansOnly();
