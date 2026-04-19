
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function diagnose() {
  const { data, error } = await supabase.from('transactions').select('*').limit(1);
  if (error) {
    console.log('Erro ao ler transactions:', error);
  } else {
    console.log('Transactions columns:', data && data.length > 0 ? Object.keys(data[0]) : 'Tabela vazia ou sem permissão de ver colunas');
  }
}
diagnose();
