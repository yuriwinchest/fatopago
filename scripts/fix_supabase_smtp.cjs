const fetch = require('node-fetch');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function fixSupabaseSmtp() {
    const projectRef = 'raxjzfvunjxqbxswuipp';
    const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!accessToken) {
        console.error('SUPABASE_ACCESS_TOKEN não encontrado no .env.local');
        return;
    }

    if (!resendApiKey) {
        console.error('RESEND_API_KEY não encontrado no .env.local — adicione a nova chave gerada no painel Resend.');
        return;
    }

    console.log(`Atualizando configuração SMTP do projeto ${projectRef}...`);

    const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            smtp_admin_email: 'acesso@auth.fatopago.com',
            smtp_host: 'smtp.resend.com',
            smtp_port: '587',
            smtp_user: 'resend',
            smtp_pass: resendApiKey,
            smtp_sender_name: 'Fatopago',
            mailer_autoconfirm: true
        })
    });

    const data = await response.json();
    if (response.ok) {
        console.log('✅ Configuração SMTP atualizada com sucesso!');
        console.log('Configuração resultante (senha mascarada):', data.smtp_pass);
    } else {
        console.error('❌ Erro ao atualizar SMTP:', data);
    }
}

fixSupabaseSmtp();
