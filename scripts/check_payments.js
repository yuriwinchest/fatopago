
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkRecentPayments() {
  console.log('--- Verificando pagamentos recentes (aprovados) ---');
  
  // Buscar ultimos 10 pagamentos aprovados
  const { data: payments, error } = await supabase
    .from('pix_payments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Erro:', error);
    return;
  }

  for (const p of payments) {
    console.log(`Payment ID: ${p.id}, User: ${p.user_id}, Status: ${p.status}, Amount: ${p.amount}, Created: ${p.created_at}`);
    
    // Verificar se gerou plano
    const { data: plans } = await supabase
      .from('plan_purchases')
      .select('*')
      .eq('user_id', p.user_id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (plans && plans.length > 0) {
      const plan = plans[0];
      const timeDiff = new Date(plan.created_at).getTime() - new Date(p.created_at).getTime();
      const isRelated = Math.abs(timeDiff) < 60000; // 1 minuto de tolerância
      console.log(`  -> Último plano: ID ${plan.id}, Status: ${plan.status}, Criado em: ${plan.created_at} (Diferença: ${timeDiff / 1000}s) - Relacionado? ${isRelated ? 'SIM' : 'NÃO'}`);
    } else {
      console.log('  -> NENHUM PLANO ENCONTRADO PARA ESTE USUÁRIO');
    }
  }
}

checkRecentPayments();
