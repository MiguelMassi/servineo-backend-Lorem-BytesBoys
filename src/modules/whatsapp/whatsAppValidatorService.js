class WhatsAppValidatorService {
  constructor() {
    this.config = this.loadConfig();
  }

  /**
   * Carga la configuración desde variables de entorno
   */
  loadConfig() {
    const config = {
      BASE_URL: process.env.WHATSAPP_BASE_URL,
      INSTANCE: process.env.WHATSAPP_INSTANCE,
      API_KEY: process.env.WHATSAPP_API_KEY
    };

    // Validar que todas las variables estén presentes
    const missingVars = Object.entries(config)
      .filter(([key, value]) => !value)
      .map(([key]) => key);

    if (missingVars.length > 0) {
      throw new Error(`Faltan variables de entorno: ${missingVars.join(', ')}`);
    }

    return config;
  }


  async validateNumbers(numbers) {
    if (!Array.isArray(numbers) || numbers.length === 0) {
      throw new Error("Se requiere un array de números válido");
    }

    const url = `${this.config.BASE_URL.replace(/\/+$/, '')}/chat/whatsappNumbers/${this.config.INSTANCE}`;

    const requestBody = {
      numbers: numbers.map(number => this.normalizeNumber(number))
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": this.config.API_KEY
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Error desconocido");
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error validando números de WhatsApp:", error);
      throw error;
    }
  }


  async validateSingleNumber(number) {
    const result = await this.validateNumbers([number]);

    const numberData = result[0];

    return {
      number,
      isValid: numberData.exists === true,  // Verificams explícitamente el campo 'exists'
      details: numberData
    };
  }


  normalizeNumber(number) {
    // Remover espacios, guiones, paréntesis, etc.
    return number.replace(/[\s\-\(\)]/g, '');
  }
}

module.exports = WhatsAppValidatorService;