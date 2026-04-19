
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkRecentPaymentsV2() {
  console.log('--- Check V2 (Validations) ---');
  
  const { data: payments, error } = await supabase
    .from('pix_payments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10); // Check last 10 payments

  for (const p of payments) {
    if (p.status !== 'approved') continue;

    console.log(`[PAYMENT] ID: ${p.id.slice(0,8)}... User: ${p.user_id.slice(0,8)}... Amount: ${p.amount} Time: ${new Date(p.created_at).toLocaleTimeString()}`);
    
    // Buscar plano ativo deste usuário
    const { data: activePlan } = await supabase
      .from('plan_purchases')
      .select('*')
      .eq('user_id', p.user_id)
      .eq('status', 'active')
      .maybeSingle();

    if (activePlan) {
      console.log(`   -> [PLAN ACTIVE] ID: ${activePlan.id.slice(0,8)}... Used: ${activePlan.used_validations}/${activePlan.max_validations}`);
      
      const timeDiff = new Date(activePlan.created_at).getTime() - new Date(p.created_at).getTime();
      const isRelated = Math.abs(timeDiff) < 120000; // 2 min
      
      if (isRelated) {
         console.log('      (Seems to be the plan from this payment)');
      } else {
         console.log('      (Old plan? Created at: ' + activePlan.created_at + ')');
         // Se tem um pagamento novo APROVADO, mas o plano ativo é VELHO e está ESGOTADO, esse é o bug.
         if (activePlan.used_validations >= activePlan.max_validations) {
            console.warn('      [BUG DETECTED] Payment approved but user stuck on old exhausted plan!');
            
            // Auto-fix here?
            console.log('      [AUTO-FIX] Marking old plan as completed...');
            await supabase.from('plan_purchases').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', activePlan.id);
            
            // Create new plan?
            console.log('      [AUTO-FIX] Creating NEW plan for payment...');
            // ... logic to create new plan ...
            // Simplified for now: Just marking old as completed allows user to "Renovar" manually, 
            // OR I can insert the new plan now.
            
            const maxVal = p.amount >= 20 ? 40 : (p.amount >= 10 ? 20 : 10); // Rough logic based on price
            const planId = p.amount >= 20 ? 'expert' : (p.amount >= 10 ? 'pro' : 'starter');
            
            const { error: insErr } = await supabase.from('plan_purchases').insert({
                user_id: p.user_id,
                plan_id: planId, // inferred
                status: 'active',
                max_validations: maxVal,
                used_validations: 0
            });
            if (insErr) console.error('Error creating plan:', insErr);
            else console.log('      [AUTO-FIX] New plan created successfully!');
         }
      }
    } else {
      console.log('   -> [NO ACTIVE PLAN] Payment approved but no active plan found. (Maybe completed or error)');
      // Verificar se existe um plano Completed recente relacionado
       const { data: completedPlan } = await supabase
        .from('plan_purchases')
        .select('*')
        .eq('user_id', p.user_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
        
       if (completedPlan && Math.abs(new Date(completedPlan.created_at).getTime() - new Date(p.created_at).getTime()) < 120000) {
           console.log('      [PLAN COMPLETED] Found related plan that is already completed/cancelled.');
       } else {
           console.warn('      [BUG DETECTED] Payment approved but NO plan created ever?');
           // Inserir plano aqui se necessário
       }
    }
  }
}

checkRecentPaymentsV2();
