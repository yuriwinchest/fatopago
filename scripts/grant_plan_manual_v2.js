
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
const USER_ID = '044a665b-f27f-4b28-bada-ebc285563aa3'; // ID CORRETO

async function grant() {
  console.log(`Granting PLAN starter to user ${USER_ID}...`);
  const now = new Date().toISOString();
  
  const { data, error } = await supabase.from('plan_purchases').insert({
    user_id: USER_ID,
    plan_id: 'starter',
    status: 'active',
    max_validations: 10,
    used_validations: 0,
    started_at: now,
    updated_at: now
  });

  if (error) console.error('Erro:', error);
  else console.log('Sucesso! Plano concedido.');
}

grant();
