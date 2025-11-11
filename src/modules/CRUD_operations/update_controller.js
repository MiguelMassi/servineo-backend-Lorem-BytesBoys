import 'express';
import {
  update_appointment_by_id,
  update_fixer_availability,
  fixer_cancell_appointment_by_id
} from './update_service.js';

// --- Importaciones y Configuración para Notificaciones ---
// Importaciones asumidas del contexto del proyecto:
import {
    get_requester_details, 
    get_fixer_details, 
    create_notification 
} from './create_service.js'; 
import { WhatsAppService } from '../whatsapp/index.js';
import * as EmailModule from '../email/lib/services/email.service.js';

const whatsappService = new WhatsAppService();
const emailService = new EmailModule.EmailService();
const WHATSAPP_RETRIES = 3; 

// --- FUNCIONES AUXILIARES ---

// Helper para formatear fecha/hora
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
    
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

// Helper para enviar notificación
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
                await whatsappService.sendText(recipient, message); 
            } else { 
                 await emailService.sendEmail({
                     to: recipient,
                     subject: subject,
                     text: html ? null : message, 
                     html: html 
                 });
            }
            status = 'SUCCESS';
            success = true;
            
        } catch (e) {
            status = 'FAILED';
            errorDetails = `Attempt ${attempt}: ${e.message}`; 
            
        }

        await create_notification({
            appointment_id: appointmentId,
            recipient_phone: recipient,
            notification_type: type,
            message_content: (contentToLog || '').substring(0, 300) + '...',
            send_status: status,
            error_details: errorDetails,
        });

        if (success) {
            return { success: true, channel: `${type} ${name}` };
        }

        if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    return { success: false, channel: `${type} ${name}` };
}

// --- FUNCIONES CONTROLADORAS (Definiciones ÚNICAS) ---

async function updateAppointmentById(req, res) {
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

async function updateFixerAvailability(req, res) {
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

async function fixerCancellAppointment(req, res) {
 const channelsSent = [];
    const channelsFailed = [];

    // --- FIX PARA ReferenceError: DECLARAMOS CON let ARRIBA ---
    let whatsappMessage = '';
    let emailSubject = '';
    let emailBody_HTML = '';
    // --------------------------------------------------------

    try {
        const { appointment_id, requester_id } = req.query;
        
        if (!appointment_id) {
            return res.status(400).json({ succeed: false, message: "Missing query parameter" });
        }
        
        // 1. Cancelar la cita y obtener el objeto de la DB
        const result = await fixer_cancell_appointment_by_id(appointment_id);
        let cancelledAppointment = result.existing;
        
        // Manejar caso: ya estaba cancelada 
        if (result.modified === false) {
            return res.status(200).json({
                succeed: true,
                message: `Appointment with id: ${appointment_id} ya estaba cancelada.`,
                modified: cancelledAppointment
            });
        }

        // 2. Determinar el ID a usar para la notificación (Usando requester_id del frontend)
        const notificationRequesterId = requester_id || cancelledAppointment.id_requester;

        // 3. Obtener detalles de USUARIOS desde la DB
        const requesterDetails = await get_requester_details(notificationRequesterId); 
        const fixerDetails = await get_fixer_details(cancelledAppointment.id_fixer); 
        
        // --- LOG CRÍTICO AÑADIDO PARA DEPURAR EL CAMPO 'telefono' ---
        console.log(`\n[DEBUG] Objeto Completo del Requester:`, requesterDetails); 
        // ------------------------------------------------------------

        const requesterName = requesterDetails.name || requesterDetails.requester_name;
        
        // Extracción y formato del teléfono (usa el campo 'telefono')
        const rawPhone = requesterDetails.telefono || ''; 
        let digitsOnly = rawPhone.replace(/\D/g, ''); 
        let cleanPhone = '+' + digitsOnly; 
        
        const requesterEmail = requesterDetails.requester_email || ''; 
        const fixerName = fixerDetails.fixer_name || 'Fixer';

        // Formato de fecha y hora
        const appointmentStartISO = cancelledAppointment.starting_time; 
        const cancelledDateTimeFormatted = formatLocalizedDateTime(appointmentStartISO);
        
        // --- LOGS DE DEPURACIÓN DE VALORES FINALES ---
        console.log(`\n--- INICIO DE DEPURACIÓN WHATSAPP ---`);
        console.log(`[DEBUG] Teléfono extraído ('telefono'): ${rawPhone}`);
        console.log(`[DEBUG] Teléfono limpio (E.164): ${cleanPhone}`);
        console.log(`[DEBUG] Email del Requester: ${requesterEmail}`);
        console.log(`------------------------------------\n`);
        // ---------------------------------------------
        
        // 4. ASIGNACIÓN DE VALORES (Ahora que están declarados con 'let' arriba)
        whatsappMessage = 
            `Hola *${requesterName}* lamentamos informarte que el fixer *${fixerName}* no podra atender tu solicitud de la fecha: 
*${cancelledDateTimeFormatted}* Disculpa las molestias`; 

        emailSubject = `❌ CITA CANCELADA: ${fixerName} - ${cancelledDateTimeFormatted}`;
        
        emailBody_HTML = `
            <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 25px; border-radius: 8px; max-width: 600px; margin: auto; line-height: 1.6; color: #333;">
                <h2 style="text-align: center; color: #DC2626; margin-top: 0;">❌ Cita Cancelada</h2>
                
                <p>Hola <strong>${requesterName}</strong>,</p>
                <p>Lamentamos informarte que el fixer <strong>${fixerName}</strong> no podrá atender tu solicitud de la fecha:</p>
                
                <p><strong>Fecha: ${cancelledDateTimeFormatted}</strong></p>
                
                <p style="text-align: center; margin-top: 30px;">
                    Disculpa las molestias.
                </p>
            </div>
        `;
        
        const notificationPromises = [];

        // 5. Notificación al REQUESTER por WhatsApp
        notificationPromises.push(
            sendNotificationWithRetry({
                appointmentId: cancelledAppointment._id,
                recipient: cleanPhone, 
                name: requesterName,
                type: 'whatsapp',
                message: whatsappMessage,
                subject: emailSubject 
            })
        );

        // 6. Notificación al REQUESTER por Email
        if (requesterEmail) {
            notificationPromises.push(
                sendNotificationWithRetry({
                    appointmentId: cancelledAppointment._id,
                    recipient: requesterEmail,
                    name: requesterName,
                    type: 'email',
                    message: whatsappMessage.replace(/\*/g, '').trim(), 
                    html: emailBody_HTML, 
                    subject: emailSubject
                })
            );
        }
        
        const rawResults = await Promise.all(notificationPromises);
        
        // ... (Procesar resultados y respuesta final)

        const finalStatus = channelsSent.length > 0 ? 'SUCCESS' : 'FAILED';
        return res.status(200).json({
            succeed: true,
            message: `Appointment with id: ${cancelledAppointment._id} cancelled. Notification status: ${finalStatus}`,
            modified: cancelledAppointment,
            channelsSent,
            channelsFailed 
        });

    } catch (error) {
        // Manejo de errores
        if (error.message === "Appointment no encontrado") {
            return res.status(404).json({ succeed: false, message: "Appointment not found for cancellation." });
        }
        
        console.error('🔥 Error general en fixerCancellAppointment:', error);
        res.status(500).json({
            succeed: false,
            message: "Error cancelling appointment",
            error: error.message
        });
    }
}

// --- EXPORTACIÓN FINAL (Exporta todas las funciones de golpe) ---
export {
  updateAppointmentById,
  updateFixerAvailability,
  fixerCancellAppointment
};
