
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Cliente ADMIN (Service Role)
const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL, 
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testTrigger() {
    console.log('--- Teste de Trigger de Criação de Usuário ---');
    
    const email = `test_trigger_${Date.now()}@test.com`;
    const password = 'Password@123';
    
    console.log(`Criando usuário Auth: ${email}`);
    
    // 1. Criar usuário no Auth
    const { data: { user }, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
            name: 'Teste Trigger',
            lastname: 'Silva',
            city: 'São Paulo',
            state: 'SP'
        }
    });

    if (createError) {
        console.error('Erro ao criar usuário Auth:', createError);
        return;
    }
    
    console.log(`Usuário criado: ${user.id}`);
    
    // 2. Esperar um pouco para o trigger rodar
    await new Promise(r => setTimeout(r, 2000));
    
    // 3. Verificar se existe em profiles
    const { data: profile, error: profError } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
        
    if (profError) {
        console.error('Erro ao buscar perfil:', profError);
    } else if (profile) {
        console.log('✅ SUCESSO! Perfil criado automaticamente pelo Trigger.');
        console.log(profile);
        
        // Limpar dados de teste
        await supabaseAdmin.auth.admin.deleteUser(user.id);
        console.log('Usuário de teste deletado.');
    } else {
        console.error('❌ FALHA! Perfil NÃO foi criado pelo trigger.');
        
        // Se falhou, vamos criar o trigger manualmente via migration
        console.log('Necessário recriar trigger.');
        await supabaseAdmin.auth.admin.deleteUser(user.id);
    }
}

testTrigger();
