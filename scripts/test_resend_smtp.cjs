
const nodemailer = require('nodemailer');

async function testSmtp() {
    const transporter = nodemailer.createTransport({
        host: "smtp.resend.com",
        port: 465,
        secure: true, // true for 465, false for 587
        auth: {
            user: "resend",
            pass: "98b0b4d685673b07d8cdac9b62b03676764bce5d6bd3994f9f780c201d9f9895",
        },
    });

    console.log("Testing SMTP connection to Resend...");
    try {
        await transporter.verify();
        console.log("SMTP Connection successful!");
        
        console.log("Sending test email...");
        const info = await transporter.sendMail({
            from: '"Fatopago" <acesso@auth.fatopago.com>',
            to: "yuriwinchest@gmail.com", // Temporary test address or something safe
            subject: "Teste de Conexão SMTP",
            text: "Se você está vendo isso, o SMTP do Resend está funcionando.",
            html: "<b>Se você está vendo isso, o SMTP do Resend está funcionando.</b>",
        });

        console.log("Message sent: %s", info.messageId);
    } catch (error) {
        console.error("SMTP Test failed:", error);
    }
}

testSmtp();
