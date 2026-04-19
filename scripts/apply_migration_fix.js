
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('--- Aplicando correção de Schema ---');

  // Adicionar coluna faltante
  const sql = `
    ALTER TABLE public.pix_payments 
    ADD COLUMN IF NOT EXISTS plan_activated_at TIMESTAMPTZ;
    
    ALTER TABLE public.pix_payments
    ADD COLUMN IF NOT EXISTS qr_code TEXT;
    
    ALTER TABLE public.pix_payments
    ADD COLUMN IF NOT EXISTS qr_code_base64 TEXT;

    ALTER TABLE public.pix_payments
    ADD COLUMN IF NOT EXISTS ticket_url TEXT;

    ALTER TABLE public.pix_payments
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

    ALTER TABLE public.pix_payments
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
  `;

  const { error } = await supabase.rpc('exec_sql', { sql_query: sql }); // Tentar via RPC se existir
  
  // Se RPC exec_sql não existir (comum), vamos tentar via pg (node-postgres) ou assumir que o usuário deve rodar no dashboard.
  // Como não tenho driver PG aqui e acesso direto, vou tentar um workaround:
  // Se o supabase-js não permite DDL direto sem RPC, vou avisar.
  
  // Porém, o erro anterior 'column does not exist' veio de um SELECT.
  // Vou tentar usar a query 'rpc' se existir uma função 'exec_sql' ou similar no banco do usuário.
  
  if (error) {
     console.error('Erro ao tentar aplicar via RPC (pode ser normal se a função não existir):', error);
     console.log('Tentando via REST (apenas se a policy permitir, o que é improvável para DDL)...');
  } else {
     console.log('Schema atualizado com sucesso via RPC.');
     return;
  }
}

// Como não posso garantir DDL via client JS sem uma função RPC específica, 
// vou criar uma função RPC temporária se possível? Não, não consigo criar função sem DDL.

// ALTERNATIVA: O usuário disse "vc tem acesso total a vps".
// Posso rodar o migrate lá? Ou usar a key para rodar uma query direta?
// O client supabase-js não roda SQL arbitrário.

console.log('Atenção: O Supabase JS Client não roda Migrations diretamente.');
console.log('Vou tentar rodar um comando SQL via RPC "exec_sql" caso exista.');
// Se falhar, vou instruir o usuário ou assumir que preciso rodar via npx supabase db push se o CLI estiver configurado.

applyMigration();
