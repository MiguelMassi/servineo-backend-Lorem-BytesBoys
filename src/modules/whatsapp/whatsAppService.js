import WhatsAppValidatorService from './whatsAppValidatorService.js';
import { whatsappConfig } from '../../config/whatsapp.config.js';

/**
 * Servicio principal para enviar mensajes de WhatsApp (usando la Evolution API o similar)
 */
class WhatsAppService {
  constructor(config = whatsappConfig) {
    this.config = config;
    this.validator = new WhatsAppValidatorService(config);
  }

  /**
   * Normaliza el formato del número.
   * @param {string} number - Número a normalizar.
   * @returns {string} Número normalizado.
   */
  normalizeNumber(number) {
    // 1. Quitar todo lo que no sea un dígito
    let normalized = String(number).replace(/\D/g, '');

    // 2. Si es un número de Bolivia (8 dígitos) y empieza con 6 o 7,
    //    le añadimos el código de país 591
    if (normalized.length === 8 && (normalized.startsWith('6') || normalized.startsWith('7'))) {
      normalized = '591' + normalized;
    }

    // 3. Añadir el sufijo de la API si no lo tiene
    //    (La API de Evolution usualmente requiere @c.us)
    if (!normalized.endsWith('@c.us')) {
      normalized += '@c.us';
    }

    // Ahora devolverá "59173796540@c.us"
    return normalized;
  }
  /**
   * Envía un mensaje de texto a un número sin validación previa.
   * @param {string} number - Número destino.
   * @param {string} text - Texto del mensaje.
   * @param {Object} options - Opciones adicionales (ej. custom_id, delay, etc.).
   * @returns {Promise<Object>} Resultado del envío.
   */
  async sendText(number, text, options = {}) {
    if (!number || !text) {
      throw new Error("Número y texto son requeridos");
    }

    // Aseguramos que la URL termina con '/' para concatenar correctamente
    const baseUrl = this.config.BASE_URL.replace(/\/+$/, '');
    const url = `${baseUrl}/message/sendText/${this.config.INSTANCE}`;

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
        throw new Error(`HTTP ${response.status}: Error de API de envío: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error enviando mensaje de WhatsApp:", error);
      throw error;
    }
  }

  /**
   * Envía un mensaje con verificación de validez de número previa.
   * @param {string} number - Número destino.
   * @param {string} text - Texto del mensaje.
   * @param {Object} options - Opciones adicionales.
   * @returns {Promise<Object>} Resultado del envío.
   */
  async sendTextWithValidation(number, text, options = {}) {
    try {
      // 1. Validamos el número
      const validation = await this.validator.validateSingleNumber(number);

      if (!validation.isValid) {
        throw new Error(`El número ${number} no es un contacto válido de WhatsApp`);
      }

      // 2. Si es válido, enviamos el mensaje
      return await this.sendText(number, text, options);
    } catch (error) {
      // Re-lanzamos el error para que el controlador lo capture
      console.error("Error en envío con validación:", error);
      throw error;
    }
  }

  /**
   * Envía mensajes a múltiples números de manera asíncrona.
   * @param {string[]} numbers - Array de números.
   * @param {string} text - Texto del mensaje.
   * @param {Object} options - Opciones adicionales.
   * @returns {Promise<Object[]>} Resultados de los envíos (éxito o error para cada uno).
   */
  async sendBulkText(numbers, text, options = {}) {
    if (!Array.isArray(numbers) || numbers.length === 0) {
      throw new Error("Se requiere un array de números válido");
    }

    const promises = numbers.map(async (number) => {
      try {
        const result = await this.sendText(number, text, options);
        return { number, success: true, data: result };
      } catch (error) {
        return { number, success: false, error: error.message };
      }
    });

    return Promise.all(promises);
  }
}

export default WhatsAppService;
