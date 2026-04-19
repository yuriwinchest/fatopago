const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function testResendApi() {
    const API_KEY = process.env.RESEND_API_KEY;
    const FROM_EMAIL = 'acesso@auth.fatopago.com'; // Use o remetente verificado na Resend
    const TO_EMAIL = 'yuriwinchest@gmail.com'; // Enviar para o seu email de teste

    if (!API_KEY) {
        console.error('RESEND_API_KEY não encontrado no .env.local — adicione a nova chave gerada no painel Resend.');
        return;
    }

    console.log("Testing Resend API (key mascarada):", API_KEY.slice(0, 6) + '...');
    
    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: FROM_EMAIL,
                to: TO_EMAIL,
                subject: 'Teste de Entrega Resend - Fatopago',
                html: '<strong>Se você recebeu este e-mail, a chave da Resend está funcionando!</strong>'
            })
        });

        const data = await response.json();
        console.log('Response Status:', response.status);
        console.log('Response Data:', data);
    } catch (err) {
        console.error('Fetch failed:', err.message);
    }
}

testResendApi();
