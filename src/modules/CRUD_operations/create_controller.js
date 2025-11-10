import 'express';
import {
  create_appointment,
  create_notification, // Servicio para registrar la notificación en DB
} from './create_service.js';

import { WhatsAppService } from '../whatsapp/index.js';
// Importamos el módulo completo como 'EmailModule'
import * as EmailModule from '../email/lib/services/email.service';

// Instanciamos los servicios para reuso
const whatsappService = new WhatsAppService();
// Accedemos al constructor (EmailService) dentro del módulo (EmailModule)
const emailService = new EmailModule.EmailService();

// Helper para formatear fecha/hora al estilo local (Criterion 10)
function formatLocalizedDateTime(isoString) {
  if (!isoString) return '[No especificada]';
  const date = new Date(isoString);

  // Usamos 'es-ES' y 'UTC' para mantener el valor de la hora guardado en DB (Criterion 10)
  const formatted = date.toLocaleString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC'
  });

  // Capitaliza la primera letra
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/**
 * Intenta enviar una notificación (WhatsApp o Email) con reintentos y registra el intento en DB.
 * (Cumple Criterios 7, 8, 11)
 * @returns {Promise<boolean>} True si el envío fue exitoso en CUALQUIER intento.
 */
async function sendNotificationWithRetry({ appointmentId, recipient, fixerName, type, message, subject, maxRetries = 3 }) {
  const recipientForLog = recipient || 'N/A';
  const isWhatsApp = type === 'whatsapp';
  const recipientForDB = type === 'whatsapp' ? recipientForLog : fixerName + ' ' + recipientForLog; // Use a more distinct field for email

  // Si no hay destinatario para el canal (Criterion 7)
  if (!recipient) {
    await create_notification({
      appointment_id: appointmentId,
      recipient_phone: recipientForLog,
      notification_type: type,
      message_content: `Skipped: No ${type} recipient found in Fixer details.`.substring(0, 300),
      send_status: 'FAILED',
      error_details: `Fixer does not have a ${type} address registered.`,
    });
    return false;
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let status = 'PENDING';
    let errorDetails = null;
    let success = false;

    try {
      if (isWhatsApp) {
        await whatsappService.sendText(recipient, message);
      } else { // Email
        await emailService.sendEmail({
          to: recipient,
          subject: subject,
          text: message
        });
      }
      status = 'SUCCESS';
      success = true;
      console.log(`Notificación de ${type} enviada a ${fixerName} en intento ${attempt}.`);

    } catch (e) {
      status = 'FAILED';
      errorDetails = `Attempt ${attempt}: ${e.message}`;
      console.error(`Error al enviar ${type} (Intento ${attempt}):`, errorDetails);
    }

    // Log el intento actual (Criterion 7)
    await create_notification({
      appointment_id: appointmentId,
      recipient_phone: recipientForDB,
      notification_type: type,
      message_content: message.substring(0, 300) + '...', // Limitar el log del mensaje
      send_status: status,
      error_details: errorDetails,
    });

    if (success) {
      return true;
    }

    // Esperar antes del siguiente reintento (Criterion 8)
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  return false; // Todos los reintentos fallaron
}

export async function createAppointment(req, res) {
  try {
    const originalAppointmentData = req.body;
    
    // Extract reprogram fields that are NOT part of the DB model for creation, but for controller logic.
    const reprogram_reason = originalAppointmentData.reprogram_reason;
    const past_date_iso = originalAppointmentData.past_date_iso;

    // Remove temporary fields from appointmentData to prevent DB schema issues in the service.
    // We create a copy to delete fields from the request body being sent to the service
    const appointmentData = { ...originalAppointmentData };
    delete appointmentData.reprogram_reason;
    delete appointmentData.past_date_iso;

    if (!appointmentData || Object.keys(appointmentData).length === 0) {
      return res.status(400).json({ success: false, message: 'Parametros insuficientes en el body.' });
    }

    // Desestructurar resultado del servicio de creación
    const {
        result: appointment,
        message_state,
        fixerDetails, // Now included in the service response
    } = await create_appointment(appointmentData);

    if (!appointment) {
      // Manejo de errores de negocio (Fixer/Requester no encontrado o Cita ya existe)
      return res.status(400).json({ success: false, message: message_state });
    } else {
      // --- LÓGICA DE DATOS Y NOTIFICACIÓN DUAL ---

      const fixerDetailsSafe = fixerDetails || {};
      const fixerEmail = fixerDetailsSafe.fixer_email;
      const fixerPhone = fixerDetailsSafe.fixer_phone || '';
      const fixerName = fixerDetailsSafe.name || 'Fixer';
      const requesterName = appointment.current_requester_name;

      // Formatting dates and getting location
      const newDateTimeFormatted = formatLocalizedDateTime(appointment.starting_time);
      const location = appointment.display_name_location || (appointment.appointment_type === 'virtual' ? appointment.link_id : 'No especificada');

      let sourceMessage;
      let emailSubject;
      const calendarLink = 'https://servineo.com/calendar';

      // ** LÓGICA CONDICIONAL: REPROGRAMACIÓN vs. NUEVA CITA **
      if (reprogram_reason && past_date_iso) {

        // --- OBTENER Y FORMATEAR LA FECHA ANTERIOR ---
        const previousStartingTimeISO = past_date_iso;
        const previousDateTimeFormatted = formatLocalizedDateTime(previousStartingTimeISO);

        // Plantilla para REPROGRAMACIÓN (Criterion 6, 9, 10)
        sourceMessage =
          `*🔄 CITA REPROGRAMADA*

Hola *${fixerName}*,

Te informamos que el Requester *${requesterName}* ha reprogramado su cita agendada.

Motivo: ${reprogram_reason}

*Fecha anterior:* ${previousDateTimeFormatted}
*Nueva fecha:* ${newDateTimeFormatted}
*Servicio:* ${appointment.appointment_description || 'No especificado'}

Por favor revisa tu calendario en la app para mantener tu disponibilidad actualizada.
[Ver Calendario](${calendarLink})`;

        emailSubject = `🔄 Cita Reprogramada por ${requesterName}`;
      } else {
        // Plantilla para NUEVA CITA AGENDADA (comportamiento original)
        sourceMessage =
          `*📅 NUEVA CITA AGENDADA*

Hola *${fixerName}*,

Tienes un nuevo servicio:

*Cliente:* ${requesterName}
*Fecha y Hora:* ${newDateTimeFormatted}
*Modalidad:* ${appointment.appointment_type === 'presential' ? 'Presencial' : 'Virtual'}
*Servicio solicitado:* ${appointment.appointment_description || 'Sin descripción'}
*Ubicación:* ${location}

Por favor, revisa mas detalles en la app.
¡Gracias por ser parte de Servineo!`;

        emailSubject = `📅 NUEVA CITA AGENDADA`;
      }
      // ** FIN LÓGICA CONDICIONAL **

      // 1. Prepare email body by stripping Markdown (Criterion 6)
      const emailBody = sourceMessage.replace(/\*/g, '').replace(/(\n\s*\n)/g, '\n\n').trim();

      const notificationPromises = [];

      // --- 3. Intento de Envío por WHATSAPP (Criterion 8) ---
      notificationPromises.push(
          sendNotificationWithRetry({
              appointmentId: appointment._id,
              recipient: fixerPhone,
              fixerName: fixerName,
              type: 'whatsapp',
              message: sourceMessage,
              subject: emailSubject
          })
      );

      // --- 4. Intento de Envío por EMAIL (Criterion 8) ---
      notificationPromises.push(
          sendNotificationWithRetry({
              appointmentId: appointment._id,
              recipient: fixerEmail,
              fixerName: fixerName,
              type: 'email',
              message: emailBody, // Email uses the plain text version (Criterion 6)
              subject: emailSubject
          })
      );

      // Esperar a que todos los intentos de notificación y registro terminen
      const notificationResults = await Promise.all(notificationPromises);

      // CRITERIO DE ÉXITO CRÍTICO: Verificar si AL MENOS una notificación fue exitosa (Criterion 11)
      const communicationSuccess = notificationResults.some(result => result === true);

      if (!communicationSuccess && reprogram_reason) {
        // If it's a reschedule AND both notifications failed, return 500 error
        return res.status(500).json({
          success: false,
          message: 'Cita creada pero la notificación de reprogramación crítica (WhatsApp/Email) falló completamente. Revise los logs.',
          created: appointment,
        });
      }

      // Success if communication worked or if it was a new appointment
      return res.status(200).json({
        success: true,
        message: 'Cita creada satisfactoriamente. (Notificaciones y registro procesados)',
        created: appointment,
      });
    }
  } catch (err) {
    console.error('Error en el controlador:', err);
    return res
      .status(500)
      .json({ success: false, message: 'Error de servidor.', error: err.message });
  }
}