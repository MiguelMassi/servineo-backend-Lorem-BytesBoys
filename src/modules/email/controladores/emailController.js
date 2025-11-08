import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
    }
});

const enviarEmail = async (req, res) => {
    try {
        const { to, subject, text, html } = req.body;

        console.log('📧 Recibiendo petición para enviar email a:', to);

        if (!to || !subject || (!text && !html)) {
            return res.status(400).json({
                success: false,
                error: 'Faltan campos requeridos: to, subject, y (text o html)'
            });
        }

        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM,
            to,
            subject,
            text,
            html
        });

        console.log('✅ Email enviado exitosamente:', info.messageId);

        res.status(200).json({
            success: true,
            messageId: info.messageId
        });

    } catch (error) {
        console.error('❌ Error al enviar email:', error.message);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

export default { enviarEmail };