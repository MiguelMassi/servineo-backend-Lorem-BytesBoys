import 'express';
import {
  create_appointment,
  create_notification, // Servicio para registrar la notificación en DB
  get_requester_details // Importamos la función de utilidad del servicio
} from './create_service.js';

import { WhatsAppService } from '../whatsapp/index.js';
import * as EmailModule from '../email/lib/services/email.service';

// Instanciamos los servicios para reuso
const whatsappService = new WhatsAppService();
const emailService = new EmailModule.EmailService();

// Helper para formatear fecha/hora al estilo local
function formatLocalizedDateTime(isoString) {
  if (!isoString) return '[No especificada]';
  const date = new Date(isoString);

  // Usamos 'es-ES' y 'UTC' para mantener el valor de la hora guardado en DB
  const formatted = date.toLocaleString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC'
  });

  // Capitaliza la primera letra y adapta el formato si es necesario
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/**
 * Intenta enviar una notificación (WhatsApp o Email) con reintentos y registra el intento en DB.
 * Retorna { success: boolean, channel: string } para el rastreo en el controlador.
 */
async function sendNotificationWithRetry({ appointmentId, recipient, name, type, message, html, subject, maxRetries = 3 }) {
  const recipientForLog = recipient || 'N/A';
  const isWhatsApp = type === 'whatsapp';

  if (!recipient) {
    await create_notification({
      appointment_id: appointmentId,
      recipient_phone: recipientForLog,
      notification_type: type,
      message_content: `Skipped: No ${type} recipient found.`,
      send_status: 'FAILED',
      error_details: `${name} does not have a ${type} address registered.`,
    });
    return { success: false, channel: `${type} ${name}` };
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let status = 'PENDING';
    let errorDetails = null;
    let success = false;
    const contentToLog = isWhatsApp ? message : (html || message);

    try {
      if (isWhatsApp) {
        // Usamos sendText ya que la validación se maneja implícitamente o en el servicio.
        await whatsappService.sendText(recipient, message);
      } else { // Email
        await emailService.sendEmail({
          to: recipient,
          subject: subject,
          text: html ? null : message, // Envía 'text' si no hay 'html'
          html: html // Envía 'html' si está presente
        });
      }
      status = 'SUCCESS';
      success = true;
      console.log(`Notificación de ${type} enviada a ${name} en intento ${attempt}.`);

    } catch (e) {
      status = 'FAILED';
      errorDetails = `Attempt ${attempt}: ${e.message}`;
      console.error(`Error al enviar ${type} (Intento ${attempt}):`, errorDetails);
    }

    // Log el intento actual
    await create_notification({
      appointment_id: appointmentId,
      recipient_phone: recipient,
      notification_type: type,
      message_content: (contentToLog || '').substring(0, 300) + '...', // Limitar el log del mensaje
      send_status: status,
      error_details: errorDetails,
    });

    if (success) {
      return { success: true, channel: `${type} ${name}` };
    }

    // Esperar antes del siguiente reintento
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  return { success: false, channel: `${type} ${name}` }; // Todos los reintentos fallaron
}


export async function createAppointment(req, res) {
  const channelsSent = [];
  const channelsFailed = [];

  try {
    const appointmentData = req.body;

    if (!appointmentData || Object.keys(appointmentData).length === 0) {
      return res.status(400).json({ success: false, message: 'Parametros insuficientes en el body.' });
    }

    // Desestructurar resultado del servicio de creación (incluye details)
    const {
      result: appointment,
      message_state,
      fixerDetails,
      requesterDetails
    } = await create_appointment(appointmentData);

    if (!appointment) {
      // Manejo de errores de negocio
      return res.status(400).json({ success: false, message: message_state });
    } else {
      // --- LÓGICA DE DATOS Y NOTIFICACIÓN DUAL ---

      // Datos del FIXER
      const fixerDetailsSafe = fixerDetails || {};
      const fixerEmail = fixerDetailsSafe.email;
      const fixerPhone = fixerDetailsSafe.whatsapp_number || '';
      const fixerName = fixerDetailsSafe.name || '';

      // Datos del REQUESTER
      const requesterDetailsSafe = requesterDetails || {};
      const requesterName = appointment.current_requester_name || requesterDetailsSafe.name;
      const requesterPhone = appointment.current_requester_phone; // Teléfono viene del body/appointment
      const requesterEmail = requesterDetailsSafe.email; // Email viene del DB/servicio

      // Formato de fecha y ubicación
      const newDateTimeFormatted = formatLocalizedDateTime(appointment.starting_time);
      const location = appointment.display_name_location || (appointment.appointment_type === 'virtual' ? appointment.link_id : 'No especificada');

      let fixerMessage;
      let fixerEmailSubject;
      const calendarLink = 'https://servineo.com/calendar';

      // ** LÓGICA CONDICIONAL: REPROGRAMACIÓN vs. NUEVA CITA (Fixer) **
      if (appointmentData.reprogram_reason) {

        const previousStartingTimeISO = appointmentData.past_date_iso;
        const previousDateTimeFormatted = formatLocalizedDateTime(previousStartingTimeISO);

        // Plantilla para REPROGRAMACIÓN (Funcionalidad Solicitada)
        fixerMessage =
          `*🔄 CITA REPROGRAMADA*

Hola *${fixerName}*,

Te informamos que el Requester *${requesterName}* ha reprogramado su cita agendada.

Motivo: ${appointmentData.reprogram_reason}

*Fecha anterior:* ${previousDateTimeFormatted}
*Nueva fecha:* ${newDateTimeFormatted}
*Servicio:* ${appointment.appointment_description || 'No especificado'}

Por favor revisa tu calendario en la app para mantener tu disponibilidad actualizada.
[Ver Calendario](${calendarLink})`;

        fixerEmailSubject = `🔄 Cita Reprogramada por ${requesterName}`;
      } else {
        // Plantilla para NUEVA CITA AGENDADA (Lógica original)
        fixerMessage =
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

        fixerEmailSubject = `📅 NUEVA CITA AGENDADA`;
      }
      // ** FIN LÓGICA CONDICIONAL (Fixer) **

      // 1. Cuerpo de Email para Fixer (sin Markdown)
      const fixerEmailBody = fixerMessage.replace(/\*/g, '').replace(/(\n\s*\n)/g, '\n\n').trim();

      const notificationPromises = [];

      // --- A. Notificación al FIXER ---

      // 1. WhatsApp Fixer
      notificationPromises.push(
        sendNotificationWithRetry({
          appointmentId: appointment._id,
          recipient: fixerPhone,
          name: 'Fixer',
          type: 'whatsapp',
          message: fixerMessage,
          subject: fixerEmailSubject
        })
      );

      // 2. Email Fixer
      notificationPromises.push(
        sendNotificationWithRetry({
          appointmentId: appointment._id,
          recipient: fixerEmail,
          name: 'Fixer',
          type: 'email',
          message: fixerEmailBody, // Email usa la versión sin formato
          subject: fixerEmailSubject
        })
      );

      // --- B. Notificación al REQUESTER (Cliente) ---

      // Plantillas para el REQUESTER
      const modalityText = appointment.appointment_type === 'presential' ? 'Presencial' : 'Virtual';
      const modalityDetails = appointment.appointment_type === 'presential'
        ? `${appointment.display_name_location || 'Ubicación no especificada'}`
        : `${appointment.link_id || 'Enlace no especificado'}`;

      // Adaptamos el formato de fecha 
      const dateText = newDateTimeFormatted.replace(/el\s+/, '').replace(/\s+a\s+las/i, ' a las');
      const detailsText = appointment.appointment_description || 'Sin descripción';

      // WhatsApp Requester
      const requesterWhatsAppMessage =
        `*✅ ¡Cita Agendada Exitosamente!*

*Profesional asignado:*
${fixerName}

*Fecha y hora:*
${dateText}

*Modalidad:*
${modalityText}

${modalityDetails}

*Detalles:*
${detailsText}

*Tu cita ha sido confirmada.*`;

      // Email HTML Requester
      const requesterEmailBody_HTML = `
            <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 25px; border-radius: 8px; max-width: 600px; margin: auto; line-height: 1.6; color: #333;">
                <h2 style="text-align: center; color: #333; margin-top: 0;">✅ ¡Cita Agendada Exitosamente!</h2>
                
                <p style="margin-bottom: 20px;">
                    <strong style="color: #000;">Profesional asignado:</strong><br>
                    ${fixerName}
                </p>
                
                <p style="margin-bottom: 20px;">
                    <strong style="color: #000;">Fecha y hora:</strong><br>
                    ${dateText}
                </p>
                
                <p style="margin-bottom: 20px;">
                    <strong style="color: #000;">Modalidad:</strong><br>
                    ${modalityText}<br>
                    <span style="color: #555; font-size: 0.9em;">${modalityDetails}</span>
                </p>
                
                <p style="margin-bottom: 20px;">
                    <strong style="color: #000;">Detalles:</strong><br>
                    ${detailsText}
                </p>
                
                <p style="color: #000; text-align: center; margin-top: 25px; margin-bottom: 0;">
                    <strong>Tu cita ha sido confirmada.</strong>
                </p>
            </div>
            `;
      const requesterEmailSubject = `✅ ¡Cita Agendada Exitosamente!`;


      // 3. WhatsApp Requester
      notificationPromises.push(
        sendNotificationWithRetry({
          appointmentId: appointment._id,
          recipient: requesterPhone,
          name: requesterName,
          type: 'whatsapp',
          message: requesterWhatsAppMessage,
          subject: requesterEmailSubject
        })
      );

      // 4. Email Requester (Usando HTML)
      notificationPromises.push(
        sendNotificationWithRetry({
          appointmentId: appointment._id,
          recipient: requesterEmail,
          name: requesterName,
          type: 'email',
          message: requesterWhatsAppMessage.replace(/\*/g, '').trim(), // Versión texto simple para fallback
          html: requesterEmailBody_HTML,
          subject: requesterEmailSubject
        })
      );


      // Esperar a que todos los intentos de notificación y registro terminen
      const rawResults = await Promise.all(notificationPromises);

      // Procesar los resultados para canales enviados/fallidos
      rawResults.forEach(result => {
        if (result && result.success) {
          channelsSent.push(result.channel);
        } else if (result && result.channel) {
          channelsFailed.push(result.channel);
        }
      });

      // Verificar si AL MENOS una notificación fue exitosa
      const communicationSuccess = channelsSent.length > 0;

      if (!communicationSuccess && appointmentData.reprogram_reason) {
        // Error crítico si es reprogramación y TODAS las notificaciones fallaron.
        return res.status(500).json({
          success: false,
          message: 'Cita creada/reprogramada, pero la notificación crítica (WhatsApp/Email) falló completamente. Revise los logs.',
          created: appointment,
          channelsSent,
          channelsFailed
        });
      }

      // Respuesta final de éxito (incluye channelsSent y channelsFailed)
      return res.status(200).json({
        success: true,
        message: 'Cita creada satisfactoriamente. (Notificaciones y registro procesados)',
        created: appointment,
        channelsSent,
        channelsFailed
      });
    }
  } catch (err) {
    console.error('Error en el controlador:', err);
    return res
      .status(500)
      .json({ success: false, message: 'Error de servidor.', error: err.message });
  }
}
