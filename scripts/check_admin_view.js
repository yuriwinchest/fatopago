
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Cliente ADMIN (Service Role) - vê tudo
const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL, 
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Cliente ANON (Simular frontend se tivessimos login, mas difícil simular auth aqui sem senha)
// Vamos focar em ver se os dados existem primeiro.

async function check() {
    console.log('--- Verificando Tabela Profiles (Service Role) ---');
    
    // Contar total
    const { count, error: countError } = await supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact', head: true });

    if (countError) {
        console.error('Erro ao contar profiles:', countError);
    } else {
        console.log(`Total de perfis no banco: ${count}`);
    }

    // Buscar usuarios recentes de auth (Service Role)
    const { data: { users }, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (authError) {
        console.error('Erro ao listar Auth Users:', authError);
    } else {
        console.log(`Total de usuários Auth: ${users.length}`);
        
        // Verificar consistencia
        const recentUser = users[0];
        if (recentUser) {
            console.log(`Ultimo usuário Auth: ${recentUser.email} (ID: ${recentUser.id})`);
            
            // Verificar se tem perfil
            const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('*')
                .eq('id', recentUser.id)
                .maybeSingle();
            
            if (profile) {
                console.log('  -> Tem perfil correspondente? SIM');
            } else {
                console.warn('  -> Tem perfil correspondente? NÃO (Trigger falhou?)');
            }
        }
    }
}

check();
