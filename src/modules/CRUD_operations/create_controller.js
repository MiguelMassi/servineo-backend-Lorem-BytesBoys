import 'express';
import {
  create_appointment,
  create_notification,
  get_fixer_details,
  get_requester_details // MODIFICADO: Importar la nueva función
} from './create_service.js';

import { WhatsAppService } from '../whatsapp/index.js';
import * as EmailModule from '../email/lib/services/email.service';

const whatsappService = new WhatsAppService();
const emailService = new EmailModule.EmailService();

export async function createAppointment(req, res) {
  try {
    const appointmentData = req.body;

    if (!appointmentData || Object.keys(appointmentData).length === 0) {
      return res.status(400).json({ success: false, message: 'Parametros insuficientes en el body.' });
    }

    const { result: appointment, message_state } = await create_appointment(appointmentData);

    console.log(appointment);
    console.log(message_state);

    if (!appointment) {
      // ... (lógica de errores de la cita sin cambios) ...
      if (message_state === 'Fixer no encontrado.') {
        return res.status(400).json({
          success: false,
          message: 'No se pudo crear la cita correctamente, id de fixer no encontrado'
        });
      }
      if (message_state === 'Requester no encontrado.') {
        return res.status(400).json({
          success: false,
          message: 'No se pudo crear la cita correctamente, id de requester no encontrado'
        });
      }
      return res.status(400).json({
        success: false,
        message: 'No se pudo crear la cita, la cita actual ya existe.',
      });
    } else {
      // --- LÓGICA DE OBTENCIÓN DE DATOS (FIXER Y REQUESTER) ---
      let fixerDetails;
      let requesterDetails; // MODIFICADO: Variable para datos del requester

      try {
        // Obtener detalles del Fixer (como antes)
        fixerDetails = await get_fixer_details(appointment.id_fixer);

        // MODIFICADO: Obtener detalles del Requester (email)
        requesterDetails = await get_requester_details(appointment.id_requester);

      } catch (err) {
        console.error(`Error crítico al obtener detalles de usuarios: ${err.message}`);
        // La cita se creó, pero falló la notificación, así que respondemos con éxito
        return res.status(200).json({
          success: true,
          message: 'Cita creada satisfactoriamente, pero falló la búsqueda de detalles para la notificación.',
          created: appointment,
        });
      }

      // --- Datos Comunes para Mensajes ---
      const appointmentDate = new Date(appointment.selected_date).toLocaleDateString('es-ES', { timeZone: 'UTC' });
      const appointmentTime = new Date(appointment.starting_time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
      const channelsSent = [];
      const channelsFailed = [];

      const notificationPromises = [];

      // --- 1. Notificación al FIXER (Lógica existente - SIN CAMBIOS) ---
      const fixerEmail = fixerDetails.fixer_email;
      const fixerPhone = fixerDetails.fixer_phone;

      const fixerLocation = appointment.display_name_location || (appointment.appointment_type === 'virtual' ? appointment.link_id : 'No especificada');
      const fixerWhatsAppMessage =
        `*📅 NUEVA CITA AGENDADA*
Hola *${fixerDetails.fixer_name}*,

Tienes un nuevo servicio:

*Cliente:* ${appointment.current_requester_name}
*Fecha:* ${appointmentDate}
*Hora:* ${appointmentTime}
*Modalidad:* ${appointment.appointment_type === 'presential' ? 'Presencial' : 'Virtual'}
*Servicio solicitado:* ${appointment.appointment_description || 'Sin descripción'}
*Ubicación:* ${fixerLocation}

Por favor, revisa mas detalles en la app.
¡Gracias por ser parte de Servineo!`;

      const fixerEmailBody = fixerWhatsAppMessage.replace(/\*/g, '').trim();
      const fixerEmailSubject = `📅 NUEVA CITA AGENDADA`;

      // 1.a. Envío WhatsApp al FIXER (SIN CAMBIOS)
      notificationPromises.push((async () => {
        let status = 'FAILED';
        let errorDet = null;
        try {
          await whatsappService.sendTextWithValidation(fixerPhone, fixerWhatsAppMessage);
          status = 'SUCCESS';
          channelsSent.push('WhatsApp Fixer');      // <-- captura exitosa
        } catch (e) {
          errorDet = e.message;
          channelsFailed.push('WhatsApp Fixer');    // <-- captura fallida

        } finally {
          await create_notification({
            appointment_id: appointment._id,
            recipient_phone: fixerPhone || 'fixer_no_phone',
            notification_type: 'whatsapp',
            message_content: fixerWhatsAppMessage,
            send_status: status,
            error_details: errorDet,
          });
        }
      })());

      // 1.b. Envío Email al FIXER (SIN CAMBIOS)
      if (fixerEmail) {
        notificationPromises.push((async () => {
          let status = 'FAILED';
          let errorDet = null;
          try {
            await emailService.sendEmail({
              to: fixerEmail,
              subject: fixerEmailSubject,
              text: fixerEmailBody
            });
            status = 'SUCCESS';
            channelsSent.push('Email Fixer');
          } catch (e) {
            errorDet = e.message;
            channelsFailed.push('Email Fixer');
          } finally {
            await create_notification({
              appointment_id: appointment._id,
              recipient_phone: fixerEmail || fixerPhone || 'email_fixer_no_phone',
              notification_type: 'email',
              message_content: fixerEmailBody,
              send_status: status,
              error_details: errorDet,
            });
          }
        })());
      }

      // --- 2. MODIFICADO: Notificación al REQUESTER (Cliente) ---

      const requesterPhone = appointment.current_requester_phone;
      const requesterEmail = requesterDetails.requester_email;

      // --- INICIO DE MODIFICACIÓN ---

      // Variables para el nuevo formato
      const modalityText = appointment.appointment_type === 'presential' ? 'Presencial' : 'Virtual';
      const modalityDetails = appointment.appointment_type === 'presential'
        ? `${appointment.display_name_location || 'Ubicación no especificada'}`
        : `${appointment.link_id || 'Enlace no especificado'}`;
      const professionalName = fixerDetails.fixer_name;
      const detailsText = appointment.appointment_description || 'Sin descripción';
      const dateText = `${appointmentDate} a las ${appointmentTime}`;

      // 1. Plantilla de WhatsApp (Con negritas)
      //    Nota: WhatsApp no permite centrar el texto.
      const requesterWhatsAppMessage =
        `*✅ ¡Cita Agendada Exitosamente!*

*Profesional asignado:*
${professionalName}

*Fecha y hora:*
${dateText}

*Modalidad:*
${modalityText}

${modalityDetails}

*Detalles:*
${detailsText}

*Tu cita ha sido confirmada.*`;

      // 2. Plantilla de Email (HTML con fondo gris y negritas)
      const requesterEmailBody_HTML = `
      <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 25px; border-radius: 8px; max-width: 600px; margin: auto; line-height: 1.6; color: #333;">
        <h2 style="text-align: center; color: #333; margin-top: 0;">✅ ¡Cita Agendada Exitosamente!</h2>
        
        <p style="margin-bottom: 20px;">
          <strong style="color: #000;">Profesional asignado:</strong><br>
          ${professionalName}
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

      // 3. Asunto para el Email
      const requesterEmailSubject = `✅ ¡Cita Agendada Exitosamente!`;

      // --- FIN DE MODIFICACIÓN ---


      // 2.a. Envío WhatsApp al REQUESTER
      notificationPromises.push((async () => {
        let status = 'FAILED';
        let errorDet = null;
        try {
          await whatsappService.sendTextWithValidation(requesterPhone, requesterWhatsAppMessage); // Mensaje actualizado
          status = 'SUCCESS';
          channelsSent.push('WhatsApp Requester');  // <-- captura exitosa
          console.log(`Notificación de WhatsApp enviada a Requester ${appointment.current_requester_name}`);
        } catch (e) {
          errorDet = e.message;
          channelsFailed.push('WhatsApp Requester'); // <-- captura fallida
          console.error('Error al enviar WhatsApp a Requester:', errorDet);
        } finally {
          await create_notification({
            appointment_id: appointment._id,
            recipient_phone: requesterPhone, // Teléfono del requester
            notification_type: 'whatsapp',
            message_content: requesterWhatsAppMessage, // Mensaje actualizado
            send_status: status,
            error_details: errorDet,
          });
        }
      })());

      // 2.b. Envío Email al REQUESTER (Modificado para usar HTML)
      if (requesterEmail) {
        notificationPromises.push((async () => {
          let status = 'FAILED';
          let errorDet = null;
          try {
            // MODIFICADO: Se envía 'html' en lugar de 'text'
            await emailService.sendEmail({
              to: requesterEmail,
              subject: requesterEmailSubject,
              html: requesterEmailBody_HTML // Usamos la plantilla HTML
            });
            status = 'SUCCESS';
            channelsSent.push('Email Requester'); // <-- captura exitosa
            console.log(`Notificación de Email enviada a Requester ${appointment.current_requester_name}`);
          } catch (e) {
            errorDet = e.message;
            channelsFailed.push('Email Requester');
            console.error('Error al enviar Email a Requester:', errorDet);
          } finally {
            await create_notification({
              appointment_id: appointment._id,
              recipient_phone: requesterEmail || requesterPhone || 'email_requester_no_phone',
              notification_type: 'email',
              message_content: requesterEmailBody_HTML, // Guardamos el HTML
              send_status: status,
              error_details: errorDet,
            });
          }
        })());
      } else {
        console.warn(`No se encontró email para el Requester ${appointment.current_requester_name}. Se omite notificación por email.`);
      }

      // --- Fin de Modificaciones ---

      // Esperar a que todos los 4 intentos de notificación terminen
      await Promise.all(notificationPromises);

      return res.status(200).json({
        success: true,
        message: 'Cita creada satisfactoriamente. (Notificaciones y registro procesados)',
        created: appointment,
        channelsSent,  // Nuevas variables para el resumen
        channelsFailed // Nuevas variables para el resumen
      });
    }
  } catch (err) {
    console.error('Error en el controlador:', err);
    return res
      .status(500)
      .json({ success: false, message: 'Error de servidor.', error: err.message });
  }
}
