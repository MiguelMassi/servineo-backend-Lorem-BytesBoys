import { whatsappConfig } from '../../config/whatsapp.config.js';

class WhatsAppValidatorService {
  /**
   * Inicializa el servicio con la configuración.
   * @param {Object} config - Configuración de WhatsApp.
   */
  constructor(config = whatsappConfig) {
    this.config = config;
  }

  /**
   * Normaliza un número de teléfono (remueve espacios, etc.)
   * @param {string} number - Número a normalizar.
   * @returns {string} Número normalizado.
   */
  normalizeNumber(number) {
    // Remover espacios, guiones, paréntesis, etc.
    return String(number).replace(/[\s\-\(\)]/g, '');
  }

  /**
   * Valida si un array de números existe en WhatsApp.
   * @param {string[]} numbers - Array de números a validar.
   * @returns {Promise<Object[]>} Un array con los resultados de la validación.
   */
  async validateNumbers(numbers) {
    if (!Array.isArray(numbers) || numbers.length === 0) {
      throw new Error("Se requiere un array de números válido");
    }

    // Aseguramos que la URL termina con '/' para concatenar correctamente
    const baseUrl = this.config.BASE_URL.replace(/\/+$/, '');
    const url = `${baseUrl}/chat/whatsappNumbers/${this.config.INSTANCE}`;

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
        throw new Error(`HTTP ${response.status}: Error de API de validación: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error validando números de WhatsApp:", error);
      throw error;
    }
  }

  /**
   * Valida un solo número de teléfono.
   * @param {string} number - Número a validar.
   * @returns {Promise<Object>} Objeto con el estado de validez (`isValid`).
   */
  async validateSingleNumber(number) {
    const result = await this.validateNumbers([number]);

    // La API de Evolution devuelve un array. Tomamos el primer elemento.
    const numberData = result[0];

    return {
      number,
      isValid: numberData && numberData.exists === true, // Verificamos que el número exista
      details: numberData
    };
  }
}

export default WhatsAppValidatorService;