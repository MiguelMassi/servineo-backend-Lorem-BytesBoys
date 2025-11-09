// src/config/whatsapp.config.js

// Usamos process.env que ya fue cargado por dotenv en app.js/index.js
const config = {
    BASE_URL: process.env.WHATSAPP_BASE_URL,
    INSTANCE: process.env.WHATSAPP_INSTANCE,
    API_KEY: process.env.WHATSAPP_API_KEY
};


function validateConfig() {
    const missingVars = Object.entries(config)
        .filter(([key, value]) => !value)
        .map(([key]) => key);

    if (missingVars.length > 0) {
        // En una app real, esto podría detener el servidor. Aquí solo avisamos.
        console.warn(`[WARNING] Faltan variables de entorno para WhatsApp: ${missingVars.join(', ')}`);
    }

    return config;
}

export const whatsappConfig = validateConfig();