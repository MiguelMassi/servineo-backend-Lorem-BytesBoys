import 'express';
import {
  create_appointment,
  create_notification, // Servicio para registrar la notificación en DB
  get_fixer_details    // Servicio para obtener datos del Fixer
} from './create_service.js';

import { WhatsAppService } from '../whatsapp/index.js';
// Importamos el módulo completo como 'EmailModule'
import * as EmailModule from '../email/lib/services/email.service';

// Instanciamos los servicios para reuso
const whatsappService = new WhatsAppService();
// Accedemos al constructor (EmailService) dentro del módulo (EmailModule)
const emailService = new EmailModule.EmailService();

export async function createAppointment(req, res) {
  try {
    const appointmentData = req.body;

    if (!appointmentData || Object.keys(appointmentData).length === 0) {
      return res.status(400).json({ success: false, message: 'Parametros insuficientes en el body.' });
    }

    // 'result' ahora contiene el objeto de la cita (gracias al cambio en create_service)
    const { result: appointment, message_state } = await create_appointment(appointmentData);

    console.log(appointment);
    console.log(message_state);

    if (!appointment) {
      // Lógica de errores de la cita...
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
      // --- LÓGICA DE OBTENCIÓN DE DATOS Y NOTIFICACIÓN DUAL ---
      let fixerDetails;
      try {
        fixerDetails = await get_fixer_details(appointment.id_fixer);
      } catch (err) {
        console.error(`Error crítico al obtener detalles del Fixer: ${err.message}`);
        return res.status(200).json({
          success: true,
          message: 'Cita creada satisfactoriamente, pero falló la búsqueda de detalles del Fixer para la notificación.',
          created: appointment,
        });
      }

      const fixerEmail = fixerDetails.fixer_email;
      const fixerPhone = fixerDetails.fixer_phone;
      const requesterName = appointment.current_requester_name;

      const appointmentDate = new Date(appointment.selected_date).toLocaleDateString('es-ES', { timeZone: 'UTC' });
      const appointmentTime = new Date(appointment.starting_time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
      const location = appointment.display_name_location || (appointment.appointment_type === 'virtual' ? appointment.link_id : 'No especificada');

      // 2. Construir el mensaje (con negritas para WhatsApp)
      const whatsappMessage =
        `*📅 NUEVA CITA AGENDADA*
Hola *${fixerDetails.fixer_name}*,

Tienes un nuevo servicio:

*Cliente:* ${requesterName}
*Fecha:* ${appointmentDate}
*Hora:* ${appointmentTime}
*Modalidad:* ${appointment.appointment_type === 'presential' ? 'Presencial' : 'Virtual'}
*Servicio solicitado:* ${appointment.appointment_description || 'Sin descripción'}
*Ubicación:* ${location}

Por favor, revisa mas detalles en la app.
¡Gracias por ser parte de Servineo!`;

      // Mensaje para Email (quitamos los asteriscos de Markdown)
      const emailBody = whatsappMessage.replace(/\*/g, '').trim();
      const emailSubject = `📅 NUEVA CITA AGENDADA `;


      const notificationPromises = [];

      // --- 3. Intento de Envío por WHATSAPP y registro ---
      notificationPromises.push((async () => {
        let status = 'FAILED';
        let errorDet = null;
        try {
          await whatsappService.sendTextWithValidation(fixerPhone, whatsappMessage);
          status = 'SUCCESS';
          console.log(`Notificación de WhatsApp enviada a Fixer ${fixerDetails.fixer_name}`);
        } catch (e) {
          errorDet = e.message;
          console.error('Error al enviar la notificación de WhatsApp:', errorDet);
        } finally {
          await create_notification({
            appointment_id: appointment._id,
            recipient_phone: fixerPhone,
            notification_type: 'whatsapp',
            message_content: whatsappMessage,
            send_status: status,
            error_details: errorDet,
          });
        }
      })());


      // --- 4. Intento de Envío por EMAIL y registro ---
      if (fixerEmail) {
        notificationPromises.push((async () => {
          let status = 'FAILED';
          let errorDet = null;
          try {
            // ******************************************************
            // CORRECCIÓN CLAVE: 
            // 1. Llamar a 'sendEmail'
            // 2. Pasar argumentos como un objeto
            await emailService.sendEmail({
              to: fixerEmail,
              subject: emailSubject,
              text: emailBody
            });
            // ******************************************************

            status = 'SUCCESS';
            console.log(`Notificación de Email enviada a Fixer ${fixerDetails.fixer_name}`);
          } catch (e) {
            errorDet = e.message;
            console.error('Error al enviar la notificación de Email:', errorDet);
          } finally {
            await create_notification({
              appointment_id: appointment._id,
              recipient_phone: fixerPhone, // NOTA: Se usa el teléfono como ID de destinatario genérico
              notification_type: 'email',
              message_content: emailBody,
              send_status: status,
              error_details: errorDet,
            });
          }
        })());
      } else {
        console.warn(`No se encontró email para el Fixer ${fixerDetails.fixer_name}. Se omite notificación por email.`);
      }

      // Esperar a que todos los intentos de notificación y registro terminen
      await Promise.all(notificationPromises);
      // ------------------------------------------

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