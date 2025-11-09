import 'express';
import {
  create_appointment,
  create_notification, // AÑADIDO: Importar el servicio para registrar notificaciones
  get_fixer_details    // AÑADIDO: Importar servicio para obtener datos del Fixer
} from './create_service.js';
import { WhatsAppService } from '../whatsapp/index.js';
// Instanciamos el servicio para reuso
const whatsappService = new WhatsAppService();

// * Fixed: fix, controladores deben devolver siempre status codes, dataExists no debe existir
// *Fixed: no esta devolviendo status code con json de respuesta, revisar dataExists
// * preguntar a vale que necesita de devolucion
// * boolean si se pudo o no

// * Mantener endpoint Vale (revisar si existen fallas con el nuevo esquema de la db).
// * Existian incompatibilidades con el esquema modificado
// ? Asuntos modificados: Ya no se actualizan appointments existentes.
// ? Si ya existe un appointment con el mismo fixer, fecha y hora, se rechaza la creacion.
export async function createAppointment(req, res) {
  try {
    const appointmentData = req.body;

    if (!appointmentData || Object.keys(appointmentData).length === 0) {
      return res.status(400).json({ success: false, message: 'Parametros insuficientes en el body.' });
    }

    // MODIFICADO: Destructuramos el objeto appointment (la cita creada) del resultado.
    const { result: appointment, message_state } = await create_appointment(appointmentData);

    console.log(appointment); // Ahora 'appointment' es el objeto de la cita o 'false'
    console.log(message_state);

    // MODIFICADO: Ahora revisamos si appointment es un objeto o si es explícitamente false/null
    if (!appointment) {
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
      // Mensaje de cita ya existente
      return res.status(400).json({
        success: false,
        message: 'No se pudo crear la cita, la cita actual ya existe.',
      });
    } else {
      // --- LÓGICA DE OBTENCIÓN DE DATOS Y NOTIFICACIÓN WHATSAPP AL FIXER ---
      let fixerDetails;
      try {
        // 1. Obtener detalles del Fixer (nombre y teléfono)
        fixerDetails = await get_fixer_details(appointment.id_fixer);
      } catch (err) {
        console.error(`Error crítico al obtener detalles del Fixer: ${err.message}`);
        // Si no podemos obtener los detalles del Fixer, aún devolvemos éxito al cliente
        return res.status(200).json({
          success: true,
          message: 'Cita creada satisfactoriamente, pero falló la búsqueda de detalles del Fixer para la notificación.',
          created: appointment,
        });
      }

      const fixerPhone = fixerDetails.fixer_phone;
      const requesterName = appointment.current_requester_name;
      const appointmentDate = new Date(appointment.selected_date).toLocaleDateString('es-ES');
      const appointmentTime = new Date(appointment.starting_time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

      // Asumimos que display_name_location es la 'Dirección' para la plantilla
      // Si es virtual, mostramos el link_id
      const location = appointment.display_name_location || (appointment.appointment_type === 'virtual' ? appointment.link_id : 'No especificada');

      // 2. Construir el mensaje de la plantilla para el FIXER
      const message =
        `📅 NUEVA CITA AGENDADA
Hola ${fixerDetails.fixer_name},
Tienes un nuevo servicio:
Cliente: ${requesterName}
Fecha: ${appointmentDate}
Hora: ${appointmentTime}
Modalidad: ${appointment.appointment_type === 'presential' ? 'Presencial' : 'Virtual'}
Servicio solicitado: ${appointment.appointment_description || 'Sin descripción'}
Ubicación: ${location}
Por favor, revisa mas detalles en la app.
¡Gracias por ser parte de Servineo!`;

      let notificationStatus = 'PENDING';
      let errorDetails = null;

      try {
        // 3. Enviar la notificación al Fixer
        await whatsappService.sendTextWithValidation(fixerPhone, message);
        notificationStatus = 'SUCCESS';
        console.log(`Notificación de WhatsApp enviada a Fixer ${fixerDetails.fixer_name} (${fixerPhone})`);
      } catch (whatsappError) {
        notificationStatus = 'FAILED';
        errorDetails = whatsappError.message;
        console.error('Error al enviar la notificación de WhatsApp al Fixer:', errorDetails);
      } finally {
        // 4. Guardar el registro de la notificación sin importar el resultado del envío
        const notificationRecord = {
          appointment_id: appointment._id,
          recipient_phone: fixerPhone,
          notification_type: 'whatsapp',
          message_content: message,
          send_status: notificationStatus,
          error_details: errorDetails,
        };
        await create_notification(notificationRecord);
      }
      // ------------------------------------------

      return res.status(200).json({
        success: true,
        message: 'Cita creada satisfactoriamente. (Notificación al Fixer y registro procesados)',
        created: appointment, // Devolvemos el objeto de la cita creada
      });
    }

  } catch (err) {
    console.error('Error en el controlador:', err);
    return res
      .status(500)
      .json({ success: false, message: 'Error de servidor.', error: err.message });
  }
}
