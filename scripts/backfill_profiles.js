
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL, 
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function backfill() {
    console.log('--- Backfill Profiles ---');
    
    // 1. Listar todos usuários Auth
    const { data: { users }, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (authError) {
        console.error('Erro Auth:', authError);
        return;
    }

    // 2. Listar todos IDs de Profiles
    const { data: profiles, error: profError } = await supabaseAdmin.from('profiles').select('id');
    
    if (profError) {
        console.error('Erro Profiles:', profError);
        return;
    }

    const profileIds = new Set(profiles.map(p => p.id));
    
    let created = 0;
    
    for (const user of users) {
        if (!profileIds.has(user.id)) {
            console.log(`Criando perfil para ${user.email} (${user.id})...`);
            
            // Tentar extrair dados do user_metadata
            const meta = user.user_metadata || {};
            const name = meta.name || user.email.split('@')[0];
            const lastname = meta.lastname || '';
            const city = meta.city || 'Não informado';
            const state = meta.state || 'XX';
            const avatar_url = meta.avatar_url || null;

            const { error: insertError } = await supabaseAdmin.from('profiles').insert({
                id: user.id,
                email: user.email,
                name: name,
                lastname: lastname,
                city: city,
                state: state,
                avatar_url: avatar_url,
                created_at: user.created_at,
                updated_at: user.updated_at
            });

            if (insertError) {
                console.error(`  Erro ao criar perfil para ${user.email}:`, insertError);
            } else {
                console.log(`  Sucesso!`);
                created++;
            }
        }
    }
    
    console.log(`Backfill concluído. Perfis criados: ${created}`);
}

backfill();
