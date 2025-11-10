const emailConfig = {
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD,
    SMTP_FROM: process.env.SMTP_FROM,
};

function validateEmailConfig() {
    const missingVars = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM']
        .filter(key => !emailConfig[key]);

    if (missingVars.length > 0) {
        console.warn(`[WARNING] Faltan variables de entorno para Email: ${missingVars.join(', ')}`);
    }
    return emailConfig;
}

export const mailConfig = validateEmailConfig();