
// ... (mesmo script, mas sem slice)
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkIds() {
    const { data } = await supabase.from('pix_payments')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(10);
        
    for(const p of data) {
        // Encontrar o user sem plano
        const { data: plans } = await supabase.from('plan_purchases').select('id').eq('user_id', p.user_id).limit(1);
        if (!plans || plans.length === 0) {
            console.log(`FOUND USER WITHOUT PLAN: ${p.user_id} (Payment ${p.id}, Amount ${p.amount})`);
        }
    }
}
checkIds();
