
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const USER_ID = '044a665b-db09-484c-a496-586b5b5c9869'; // User identified
const PLAN_ID = 'starter';
const MAX_VAL = 10;

async function grantPlan() {
  console.log(`Granting PLAN ${PLAN_ID} to user ${USER_ID}...`);

  // Verificar se já tem plano ativo (vai que criou nesse meio tempo)
  const { data: active } = await supabase.from('plan_purchases').select('*').eq('user_id', USER_ID).eq('status', 'active').maybeSingle();
  
  if (active) {
    if (active.used_validations >= active.max_validations) {
        console.log('User has exhausted active plan. Marking completed...');
        await supabase.from('plan_purchases').update({ status: 'completed' }).eq('id', active.id);
    } else {
        console.log('User already has valid active plan. Skipping.');
        return;
    }
  }

  const now = new Date().toISOString();
  
  const { data, error } = await supabase.from('plan_purchases').insert({
    user_id: USER_ID,
    plan_id: PLAN_ID,
    status: 'active',
    max_validations: MAX_VAL,
    used_validations: 0,
    started_at: now,
    updated_at: now
  }).select().single();

  if (error) console.error('Error inserting plan:', error);
  else console.log('SUCCESS! Plan created:', data);
  
  // Update payment to say activated? (Optional, as column might not exist or be needed just for record)
}

grantPlan();
