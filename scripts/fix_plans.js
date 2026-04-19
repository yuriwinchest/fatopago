
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Carregar variáveis de ambiente (priorizando .env.local)
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Erro: VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não encontrados no .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const PLAN_LIMITS = {
  starter: 10,
  pro: 20,
  expert: 40,
};

async function fixStuckPlans() {
  console.log('--- Iniciando correção de planos travados ---');

  // 1. Marcar planos esgotados como 'completed'
  const { data: exhaustedPlans, error: fetchError } = await supabase
    .from('plan_purchases')
    .select('*')
    .eq('status', 'active');

  if (fetchError) {
    console.error('Erro ao buscar planos ativos:', fetchError);
    return;
  }

  let fixedCount = 0;
  for (const plan of exhaustedPlans) {
    if (plan.used_validations >= plan.max_validations) {
      console.log(`Marcando plano esgotado como concluído: ID ${plan.id}, User ${plan.user_id}, Usado: ${plan.used_validations}/${plan.max_validations}`);
      
      const { error: updateError } = await supabase
        .from('plan_purchases')
        .update({ 
            status: 'completed', 
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .eq('id', plan.id);

      if (updateError) {
        console.error(`Erro ao atualizar plano ${plan.id}:`, updateError);
      } else {
        fixedCount++;
      }
    }
  }
  console.log(`Planos esgotados corrigidos: ${fixedCount}`);
}

async function processPendingPayments() {
  console.log('--- Processando pagamentos aprovados sem plano ativo ---');

  // 2. Buscar pagamentos aprovados que não ativaram plano
  // Nota: plan_activated_at IS NULL é o indicador chave
  const { data: stuckPayments, error: payError } = await supabase
    .from('pix_payments')
    .select('*')
    .eq('status', 'approved')
    .is('plan_activated_at', null);

  if (payError) {
    console.error('Erro ao buscar pagamentos travados:', payError);
    return;
  }

  console.log(`Encontrados ${stuckPayments.length} pagamentos aprovados pendentes de ativação.`);

  for (const payment of stuckPayments) {
    console.log(`Processando pagamento ${payment.id} para usuário ${payment.user_id} (Plano: ${payment.plan_id})`);

    // Verificar se usuário JÁ tem um plano ativo (agora que rodamos o fixStuckPlans, só deve ter se for um plano NOVO com saldo)
    const { data: activePlan } = await supabase
        .from('plan_purchases')
        .select('*')
        .eq('user_id', payment.user_id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();

    if (activePlan) {
        console.warn(`Usuário ${payment.user_id} já tem um plano ativo (ID: ${activePlan.id}) com saldo. Ignorando ativação automática por segurança.`);
        // Opcional: poderíamos somar saldo, mas a regra atual é um plano por vez.
        // Se o plano ativo tiver saldo, o usuário não deveria ter conseguido comprar outro, a menos que o sistema falhou antes.
        // Como corrigimos os esgotados antes, esse 'activePlan' aqui deve ser legítimo (com saldo).
        continue;
    }

    // Ativar o plano
    const maxValidations = PLAN_LIMITS[payment.plan_id] || 10;
    const now = new Date().toISOString();

    const { error: insertError } = await supabase.from('plan_purchases').insert({
        user_id: payment.user_id,
        plan_id: payment.plan_id,
        status: 'active',
        max_validations: maxValidations,
        used_validations: 0,
        started_at: now,
        updated_at: now,
    });

    if (insertError) {
        console.error(`Erro ao inserir plano para pagamento ${payment.id}:`, insertError);
        continue;
    }

    // Marcar pagamento como processado
    const { error: updatePayError } = await supabase
        .from('pix_payments')
        .update({ 
            plan_activated_at: now,
            updated_at: now 
        })
        .eq('id', payment.id);

    if (updatePayError) {
        console.error(`Erro ao atualizar data de ativação do pagamento ${payment.id}:`, updatePayError);
    } else {
        console.log(`SUCESSO: Plano ativado para pagamento ${payment.id}`);
    }

    // Registrar transação se não existir
    // (A transactions é normalmente criada junto, mas se falhou no webhook, pode faltar)
    // Vamos verificar se existe transação de débito recente
    /*
    const { data: txn } = await supabase.from('transactions')
        .select('*')
        .eq('user_id', payment.user_id)
        .eq('amount', payment.amount)
        .order('created_at', { ascending: false })
        .limit(1);

    if (!txn || txn.length === 0) {
         await supabase.from('transactions').insert({
          user_id: payment.user_id,
          amount: payment.amount,
          type: 'debit',
          description: `Compra Plano ${payment.plan_id.charAt(0).toUpperCase() + payment.plan_id.slice(1)} (PIX - Recuperado)`,
          status: 'completed',
        });
        console.log('Transação de débito registrada (recuperação).');
    }
    */
  }
}

async function main() {
    await fixStuckPlans();
    await processPendingPayments();
    console.log('--- Concluído ---');
}

main();
