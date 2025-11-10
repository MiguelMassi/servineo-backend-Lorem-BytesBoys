import * as dotenv from 'dotenv';
import db_connection from '../../database.js';
import Appointment from '../../models/Appointment.js';
import Notification from '../../models/Notifications.js';
import mongoose from 'mongoose';

dotenv.config();

let connected = false;

async function set_db_connection() {
  if (!connected) {
    await db_connection();
    connected = true;
  }
}

// Función para crear una nueva cita (incluida la cita reprogramada)
async function create_appointment(current_appointment) {
  try {
    await set_db_connection();
    const requester_id = current_appointment.id_requester;
    const fixer_id = current_appointment.id_fixer;
    const date_selected = current_appointment.selected_date;
    const time_starting = current_appointment.starting_time;

    const db = mongoose.connection.db
    // Check if IDs are valid ObjectId before using new mongoose.Types.ObjectId
    if (!mongoose.Types.ObjectId.isValid(fixer_id)) {
        return { result: false, message_state: 'ID de Fixer inválido.' };
    }
    if (!mongoose.Types.ObjectId.isValid(requester_id)) {
        return { result: false, message_state: 'ID de Requester inválido.' };
    }
    
    const formated_id_fixer = new mongoose.Types.ObjectId(fixer_id);
    const formated_id_requester = new mongoose.Types.ObjectId(requester_id);

    // Fetch Requester details for validation and response
    const existingRequester = await db.collection('users').findOne({
      _id: formated_id_requester
    }, { projection: { name: 1, _id: 0, role: 1 } }); 

    if (!existingRequester || existingRequester.role !== 'requester') {
      return { result: false, message_state: 'Requester no encontrado.' }
    }

    // Fetch Fixer details (incluyendo whatsapp, whatsapp_number y email para notificaciones)
    const existingFixer = await db.collection('users').findOne({
      _id: formated_id_fixer
    }, { projection: { name: 1, whatsapp: 1, whatsapp_number: 1, role: 1, _id: 0, email: 1 } }); 

    if (!existingFixer || existingFixer.role !== 'fixer') {
      return { result: false, message_state: 'Fixer no encontrado.' }
    }

    const exists = await Appointment.findOne({
      id_fixer: fixer_id,
      selected_date: date_selected,
      starting_time: time_starting
    });
    console.log(exists);
    let appointment = null;
    
    const fixerDetailsToReturn = {
        name: existingFixer.name,
        fixer_phone: existingFixer.whatsapp_number || existingFixer.whatsapp || '', 
        fixer_email: existingFixer.email
    };

    const requesterDetailsToReturn = existingRequester;

    if (!exists || (exists && exists.cancelled_fixer)) {
      appointment = new Appointment(current_appointment);
      await appointment.save();

      // Devolver detalles al controlador para la notificación
      return { 
        result: appointment, 
        message_state: 'Cita creada correctamente.',
        fixerDetails: fixerDetailsToReturn,
        requesterDetails: requesterDetailsToReturn
      };
    } else if (exists && exists.schedule_state === 'cancelled') {
        const id_appointmente_exists = exists._id;
        current_appointment.schedule_state = 'booked';
        // Clear reprogram_reason if not explicitly passed by frontend (e.g., in a reactivation)
        if (!current_appointment.reprogram_reason) {
            current_appointment.reprogram_reason = '';
        }

        const updatedAppointment = await Appointment.findByIdAndUpdate(
          id_appointmente_exists,
          { $set: current_appointment },
          { new: true }
        );
        
        return { 
          result: updatedAppointment, 
          message_state: 'Cita creada correctamente.',
          fixerDetails: fixerDetailsToReturn,
          requesterDetails: requesterDetailsToReturn
        };
    } else {
      // MODIFICADO: Devolver 'false' ya que la cita existe y no se creó
      return { result: false, message_state: 'No se puede crear la cita, la cita ya existe.' };
    }
  } catch (err) {
    throw new Error('Error creating appointment: ' + err.message);
  }
}

// Función para guardar el registro de notificación
async function create_notification(notification_data) {
  try {
    await set_db_connection();
    // La instanciación del modelo debe ser 'new Notification(...)'
    const new_notification = new Notification(notification_data);
    await new_notification.save();
    return true;
  } catch (err) {
    console.error('Error saving notification record:', err.message);
    return false;
  }
}

export {
  create_appointment,
  create_notification,
};