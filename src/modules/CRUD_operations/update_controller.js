import 'express';
import {
  update_appointment_by_id,
  update_fixer_availability,
  fixer_cancell_appointment_by_id,
  get_consecutive_cancellation_count // <-- AÑADIDO: Importar nuevo servicio
} from './update_service.js';

// --- INICIO DE IMPORTACIONES AÑADIDAS ---

// Importar servicios de notificación y helpers
import { WhatsAppService } from '../whatsapp/index.js';
import * as EmailModule from '../email/lib/services/email.service';
import { get_fixer_details, create_notification } from './create_service.js';
import Notification from '../../models/Notifications.js';

// Definir el umbral de cancelaciones
const CANCELLATION_THRESHOLD = 3; // (Criterio 5)

// Instanciar servicios
const whatsappService = new WhatsAppService();
const emailService = new EmailModule.EmailService();

// --- FIN DE IMPORTACIONES AÑADIDAS ---


// * Fixed Endpoint Pichon: Refactorizar y probar en Postman.
// * El endpoint estaba actualizando mas slots de los que deberia, ahora con el nuevo esquema actualiza lo solicitado.
export async function updateAppointmentById(req, res) {
  try {
    const id = req.query.id;
    const attributes = req.body;

    if (!id || !attributes) {
      return res.status(400).json({ message: 'Missing parameters: required id and attributes.' });
    }

    const updateAttributes = Object.fromEntries(
      Object.entries(attributes).filter((v) => v !== undefined && v !== null)
    );

    const modified = await update_appointment_by_id(id, updateAttributes);

    return res.status(200).json({ message: 'Updated succesfully', modified });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: 'Error updating appointment data.', modified: false, error: err.message });
  }
}

export async function updateFixerAvailability(req, res) {
  try {
    const { fixer_id, availability } = req.body;
    if (!fixer_id || !availability) {
      return res.status(400).json({ message: 'Missing parameters: required fixer_id and availability.' });
    }
    await update_fixer_availability(fixer_id, availability);
    return res.status(200).json({ message: 'Fixer availability updated successfully.', updated: true });
  } catch (err) {
    return res.status(500).json({ message: 'Error al actualizar disponibilidad: ' + err.message, updated: false });
  }
}

export async function fixerCancellAppointment(req, res) {
  try {
    const { appointment_id } = req.query;
    if (!appointment_id) {
      return res.status(400).json({
        succedd: false,
        message: "Missing query parameter"
      });
    }

    // 1. Cancelar la cita (ahora devuelve el objeto completo)
    const modified_appointment = await fixer_cancell_appointment_by_id(appointment_id);

    // 2. Enviar respuesta al usuario INMEDIATAMENTE (Criterio 12)
    res.status(200).json({
      succeed: true,
      message: `Appointment with id: ${appointment_id} cancelled`,
      modified: modified_appointment
    });

    // 3. Ejecutar lógica de notificación de forma asíncrona
    (async () => {
      try {
        const fixer_id = modified_appointment.id_fixer;
        const last_cancellation_time = modified_appointment.updatedAt; // (Criterio 4)

        // Contar cancelaciones consecutivas
        const count = await get_consecutive_cancellation_count(fixer_id);

        // Si se alcanza el umbral (Criterios 1 y 5)
        if (count >= CANCELLATION_THRESHOLD) {
          console.log(`Fixer ${fixer_id} alcanzó el umbral con ${count} cancelaciones.`);

          const fixerDetails = await get_fixer_details(fixer_id);

          // Criterio 9: Verificar duplicados (Idempotencia)
          // Comprobamos si ya enviamos una alerta *para este mismo número* de cancelaciones.
          const count_identifier = `Total de cancelaciones recientes:${count}.`;
          const last_warning = await Notification.findOne({
            recipient_phone: fixerDetails.fixer_phone,
            notification_type: 'cancellation_warning'
          }).sort({ createdAt: -1 });

          if (last_warning && last_warning.message_content.includes(count_identifier)) {
            console.log(`Skipping duplicate notification for count ${count}.`);
            return; // Ya se envió esta alerta específica
          }
          
          // Criterios 2, 4, 10: Construir el mensaje
          const formatted_date = new Date(last_cancellation_time).toLocaleString('es-ES', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', timeZone: 'UTC' // Asumimos UTC
          });

          // Plantilla de alerta
          const message_template =
`ALERTA DE MÚLTIPLES CANCELACIONES
Hola ${fixerDetails.fixer_name},
Has alcanzado ${count} cancelaciones consecutivas.
Total de cancelaciones recientes:${count}.
Última cancelación: ${formatted_date}.
Evitar cancelaciones innecesarias para no recibir restricciones.`;

          // Mensajes para WhatsApp (con Markdown básico) y Email
          const whatsappMessage = message_template
            .replace('ALERTA DE MÚLTIPLES CANCELACIONES', '*ALERTA DE MÚLTIPLES CANCELACIONES*')
            .replace(`Hola ${fixerDetails.fixer_name}`, `Hola *${fixerDetails.fixer_name}*`);
          
          const emailBody = message_template;
          const emailSubject = "ALERTA: Múltiples Cancelaciones de Citas";

          let primary_send_success = false;
          let primary_error = null;

          // Criterio 7: Enviar por canal preferido (Asumimos WhatsApp)
          if (fixerDetails.fixer_phone) {
            try {
              // (NOTA: El Criterio 8 (Retry) debería implementarse dentro del servicio de envío)
              await whatsappService.sendTextWithValidation(fixerDetails.fixer_phone, whatsappMessage);
              primary_send_success = true;
              console.log(`Advertencia de cancelación enviada por WhatsApp a ${fixerDetails.fixer_name}`);

              // Criterio 13: Registrar éxito
              await create_notification({
                appointment_id: appointment_id,
                recipient_phone: fixerDetails.fixer_phone,
                notification_type: 'cancellation_warning',
                message_content: whatsappMessage,
                send_status: 'SUCCESS',
                error_details: null,
              });

            } catch (e) {
              console.error('Falló envío de advertencia por WhatsApp:', e.message);
              primary_error = e.message;
            }
          }

          // Criterio 11: Canal alternativo (Email) si falla el primario
          if (!primary_send_success && fixerDetails.fixer_email) {
            console.log('Falló WhatsApp. Intentando Email como fallback...');
            try {
              await emailService.sendEmail({
                to: fixerDetails.fixer_email,
                subject: emailSubject,
                text: emailBody
              });
              console.log(`Advertencia de cancelación enviada por Email a ${fixerDetails.fixer_name}`);
              
              // Criterio 13: Registrar éxito del fallback
              await create_notification({
                appointment_id: appointment_id,
                recipient_phone: fixerDetails.fixer_phone,
                notification_type: 'cancellation_warning_email_fallback',
                message_content: emailBody,
                send_status: 'SUCCESS',
                error_details: null,
              });

            } catch (e_email) {
              console.error('Falló envío de advertencia por Email (fallback):', e_email.message);
              // Registrar fallo definitivo (ambos canales)
              await create_notification({
                appointment_id: appointment_id,
                recipient_phone: fixerDetails.fixer_phone,
                notification_type: 'cancellation_warning',
                message_content: whatsappMessage,
                send_status: 'FAILED',
                error_details: `WhatsApp Error: ${primary_error}. Email Error: ${e_email.message}`,
              });
            }
          } else if (!primary_send_success) {
            // Falló WhatsApp y no hay email
            await create_notification({
              appointment_id: appointment_id,
              recipient_phone: fixerDetails.fixer_phone,
              notification_type: 'cancellation_warning',
              message_content: whatsappMessage,
              send_status: 'FAILED',
              error_details: `WhatsApp Error: ${primary_error}. No fallback email available.`,
            });
          }

          // Criterio 15: Escalado (Si superan el umbral por mucho)
          if (count > (CANCELLATION_THRESHOLD + 2)) { // Ej: Si el umbral es 3, escala a partir de 6
             console.warn(`ESCALADO: Fixer ${fixer_id} tiene ${count} cancelaciones consecutivas. Notificar a admin.`);
             // (Aquí se podría enviar un email a un administrador)
             // await emailService.sendEmail({ to: 'admin@servineo.com', ... });
          }

        } // Fin if count >= THRESHOLD

      } catch (notification_error) {
        console.error('Error fatal en la lógica de notificación asíncrona:', notification_error.message);
      }
    })(); // Fin de la función asíncrona autoejecutable

  } catch (error) {
    // Captura errores de 'fixer_cancell_appointment_by_id'
    res.status(500).json({
      succeed: false,
      message: "Error cancelling appointment",
      error: error.message
    });
  }
}

export default {
  updateAppointmentById
};