async function testResendApi() {
    const API_KEY = 're_V4V2C7u1_sVLK5iUnebgfnTwGEprYbT4L';
    const FROM_EMAIL = 'acesso@auth.fatopago.com'; // Use o remetente verificado na Resend
    const TO_EMAIL = 'yuriwinchest@gmail.com'; // Enviar para o seu email de teste
    
    console.log("Testing Resend API with key:", API_KEY);
    
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
