import * as dotenv from 'dotenv';
import db_connection from '../../database.js';
import Appointment from '../../models/Appointment.js';
import Notification from '../../models/Notifications.js'; // AÑADIDO
import mongoose from 'mongoose';

dotenv.config();

let connected = false;

async function set_db_connection() {
  if (!connected) {
    await db_connection();
    connected = true;
  }
}

//Citas
// * Mantener endpoint Vale (revisar si existen fallas con el nuevo esquema de la db).
// * Existian incompatibilidades con el esquema modificado
// ? Asuntos modificados: Ya no se actualizan appointments existentes.
// ? Si ya existe un appointment con el mismo fixer, fecha y hora, se rechaza la creacion.
async function create_appointment(current_appointment) {
  try {
    await set_db_connection();
    const requester_id = current_appointment.id_requester;
    const fixer_id = current_appointment.id_fixer;
    const date_selected = current_appointment.selected_date;
    const time_starting = current_appointment.starting_time;

    const db = mongoose.connection.db
    const formated_id_fixer = new mongoose.Types.ObjectId(fixer_id);
    const formated_id_requester = new mongoose.Types.ObjectId(requester_id);

    const existingRequester = await db.collection('users').findOne({
      _id: formated_id_requester
    });
    if (!existingRequester || existingRequester.role !== 'requester') {
      return { result: false, message_state: 'Requester no encontrado.' }
    }

    const existingFixer = await db.collection('users').findOne({
      _id: formated_id_fixer
    });
    if (!existingFixer || existingFixer.role !== 'fixer') {
      return { result: false, message_state: 'Fixer no encontrado.' }
    }

    const exists = await Appointment.findOne({
      id_fixer: fixer_id,
      id_requester: requester_id,
      selected_date: date_selected,
      starting_time: time_starting
    });
    console.log(exists);
    let appointment = null;
    if (!exists || (exists && exists.cancelled_fixer)) {
      appointment = new Appointment(current_appointment);
      await appointment.save();
      // MODIFICADO: Devolver 'appointment' en lugar de 'true'
      return { result: appointment, message_state: 'Cita creada correctamente.' };
    } else if (exists && exists.schedule_state === 'cancelled') {
      const id_appointmente_exists = exists._id;
      current_appointment.schedule_state = 'booked';
      current_appointment.reprogram_reason = '';

      // MODIFICADO: Devolver el 'updatedAppointment' en lugar de 'true'
      const updatedAppointment = await Appointment.findByIdAndUpdate(
        id_appointmente_exists,
        { $set: current_appointment },
        { new: true }
      );
      return { result: updatedAppointment, message_state: 'Cita creada correctamente.' };
    } else {
      // MODIFICADO: Devolver 'false' ya que la cita existe y no se creó
      return { result: false, message_state: 'No se puede crear la cita, la cita ya existe.' };
    }
  } catch (err) {
    throw new Error('Error creating appointment: ' + err.message);
  }
}

// --- INICIO DE CÓDIGO AÑADIDO ---

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

// Función para obtener datos del Fixer
async function get_fixer_details(fixer_id) {
  try {
    await set_db_connection();
    const db = mongoose.connection.db;
    const formated_id_fixer = new mongoose.Types.ObjectId(fixer_id);

    // MODIFICADO: Proyectamos 'whatsapp' y 'email'
    const fixer = await db.collection('users').findOne(
      { _id: formated_id_fixer },
      { projection: { name: 1, whatsapp: 1, email: 1, _id: 0 } }
    );

    if (!fixer) {
      throw new Error("Fixer details not found in users collection.");
    }

    // Retornamos el email y el whatsapp
    return {
      fixer_name: fixer.name || 'Fixer',
      fixer_phone: fixer.whatsapp || '',
      fixer_email: fixer.email || null
    };

  } catch (err) {
    console.error('Error fetching fixer details:', err.message);
    throw new Error('No se pudo obtener el Fixer para notificación.');
  }
}
// --- FIN DE CÓDIGO AÑADIDO ---


export {
  create_appointment,
  create_notification, // AÑADIDO
  get_fixer_details,   // AÑADIDO
};