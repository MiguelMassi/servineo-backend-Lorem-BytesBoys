const whatsappConfig = {
    BASE_URL: process.env.WHATSAPP_BASE_URL,
    INSTANCE: process.env.WHATSAPP_INSTANCE,
    API_KEY: process.env.WHATSAPP_API_KEY
};


function validateConfig() {
    const missingVars = Object.entries(whatsappConfig)
        .filter(([key, value]) => !value)
        .map(([key]) => key);

    if (missingVars.length > 0) {
        throw new Error(`Faltan variables de entorno para WhatsApp: ${missingVars.join(', ')}`);
    }

    return whatsappConfig;
}

module.exports = {
    whatsappConfig: validateConfig()
};