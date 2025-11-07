const WhatsAppValidatorService = require('./whatsAppValidatorService');
const { whatsappConfig } = require('../../config/whatsapp.config');

/**
 * Servicio principal para enviar mensajes de WhatsApp
 */
class WhatsAppService {
  constructor(config = whatsappConfig) {
    this.config = config;
    this.validator = new WhatsAppValidatorService(config);
  }

  /**
   * Envía un mensaje de texto a un número
   * @param {string} number - Número destino
   * @param {string} text - Texto del mensaje
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<Object>} Resultado del envío
   */
  async sendText(number, text, options = {}) {
    if (!number || !text) {
      throw new Error("Número y texto son requeridos");
    }

    const url = `${this.config.BASE_URL.replace(/\/+$/, '')}/message/sendText/${this.config.INSTANCE}`;
    
    const requestBody = {
      number: this.normalizeNumber(number),
      text,
      options
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
      console.error("Error enviando mensaje de WhatsApp:", error);
      throw error;
    }
  }

  /**
   * Envía un mensaje con verificación previa
   * @param {string} number - Número destino
   * @param {string} text - Texto del mensaje
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<Object>} Resultado del envío
   */
  async sendTextWithValidation(number, text, options = {}) {
    try {
      // Primero validamos el número CON LA VERSIÓN CORREGIDA
      const validation = await this.validator.validateSingleNumber(number);
      
      if (!validation.isValid) {
        throw new Error(`El número ${number} no es válido en WhatsApp`);
      }

      // Si es válido, enviamos el mensaje
      return await this.sendText(number, text, options);
    } catch (error) {
      console.error("Error en envío con validación:", error);
      throw error;
    }
  }

  /**
   * Envía mensajes a múltiples números
   * @param {string[]} numbers - Array de números
   * @param {string} text - Texto del mensaje
   * @param {Object} options - Opciones adicionales
   * @returns {Promise<Object[]>} Resultados de los envíos
   */
  async sendBulkText(numbers, text, options = {}) {
    if (!Array.isArray(numbers) || numbers.length === 0) {
      throw new Error("Se requiere un array de números válido");
    }

    const results = [];

    for (const number of numbers) {
      try {
        const result = await this.sendText(number, text, options);
        results.push({
          number,
          success: true,
          data: result
        });
      } catch (error) {
        results.push({
          number,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Normaliza el formato del número
   * @param {string} number - Número a normalizar
   * @returns {string} Número normalizado
   */
  normalizeNumber(number) {
    return number.replace(/[\s\-\(\)]/g, '');
  }
}

module.exports = WhatsAppService;
