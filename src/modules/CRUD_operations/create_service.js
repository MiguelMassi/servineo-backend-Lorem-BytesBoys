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
export async function create_appointment(current_appointment) {
  try {
    await set_db_connection();
    const requester_id = current_appointment.id_requester;
    const fixer_id = current_appointment.id_fixer;
    const date_selected = current_appointment.selected_date;
    const time_starting = current_appointment.starting_time;

    const db = mongoose.connection.db
    const formated_id_fixer = new mongoose.Types.ObjectId(fixer_id);
    const formated_id_requester = new mongoose.Types.ObjectId(requester_id);

    // 1. Fetch Requester details for validation and response
    const existingRequester = await db.collection('users').findOne({
      _id: formated_id_requester
    }, { projection: { name: 1, _id: 0, role: 1, email: 1, telefono: 1 } }); // Añadir telefono
    

    if (!existingRequester || existingRequester.role !== 'requester') {
      return { result: false, message_state: 'Requester no encontrado.' }
    }

    // 2. Fetch Fixer details (incluyendo datos para notificaciones)
    const existingFixer = await db.collection('users').findOne({
      _id: formated_id_fixer
    }, { projection: { name: 1, whatsapp: 1, whatsapp_number: 1, role: 1, _id: 0, email: 1 } }); 

    if (!existingFixer || existingFixer.role !== 'fixer') {
      return { result: false, message_state: 'Fixer no encontrado.' }
    }

    // 3. Buscar si la cita ya existe (solo por fecha y fixer para evitar doble reserva)
    const exists = await Appointment.findOne({
      id_fixer: fixer_id,
      selected_date: date_selected,
      starting_time: time_starting
    });

    let appointment = null;
    let message_state = '';

    // 4. Lógica de creación / actualización
    if (!exists || (exists && exists.cancelled_fixer)) {
      appointment = new Appointment(current_appointment);
      await appointment.save();
      message_state = 'Cita creada correctamente.';
    } else if (exists && exists.schedule_state === 'cancelled') {
      const id_appointmente_exists = exists._id;
      current_appointment.schedule_state = 'booked';
      current_appointment.reprogram_reason = '';

      appointment = await Appointment.findByIdAndUpdate(
        id_appointmente_exists,
        { $set: current_appointment },
        { new: true }
      );
      message_state = 'Cita creada/reprogramada correctamente.';
    } else {
      return { result: false, message_state: 'No se puede crear la cita, la cita ya existe.' };
    }
    
    // 5. Devolver detalles de la cita y los usuarios al controlador
    return { 
      result: appointment, 
      message_state: message_state,
      fixerDetails: {
        name: existingFixer.name, // Clave estandarizada a 'name'
        whatsapp_number: existingFixer.whatsapp_number || existingFixer.whatsapp || '', 
        email: existingFixer.email
      },
      requesterDetails: {
        name: existingRequester.name || current_appointment.current_requester_name,
        email: existingRequester.email,
        telefono: existingRequester.telefono // Añadir telefono
      }
    };

  } catch (err) {
    throw new Error('Error creating appointment: ' + err.message);
  }
}

// Función para guardar el registro de notificación
export async function create_notification(notification_data) {
  try {
    await set_db_connection();
    const new_notification = new Notification(notification_data);
    await new_notification.save();
    return true;
  } catch (err) {
    console.error('Error saving notification record:', err.message);
    return false;
  }
}

// Función para obtener datos del Fixer (Mantenida como función de utilidad)
export async function get_fixer_details(fixer_id) {
  try {
    await set_db_connection();
    const db = mongoose.connection.db;
    const formated_id_fixer = new mongoose.Types.ObjectId(fixer_id);

    const fixer = await db.collection('users').findOne(
      { _id: formated_id_fixer },
      { projection: { name: 1, whatsapp: 1, email: 1, whatsapp_number: 1, _id: 0 } }
    );

    if (!fixer) {
      throw new Error("Fixer details not found in users collection.");
    }

    return {
      name: fixer.name || 'Fixer', // <-- Cambio clave: de 'fixer_name' a 'name'
      fixer_phone: fixer.whatsapp_number || fixer.whatsapp || '',
      fixer_email: fixer.email || null
    };

  } catch (err) {
    console.error('Error fetching fixer details:', err.message);
    throw new Error('No se pudo obtener el Fixer para notificación.');
  }
}

// Función para obtener datos del Requester (Mantenida como función de utilidad)
export async function get_requester_details(requester_id) {
  try {
    await set_db_connection();
    const db = mongoose.connection.db;
    const formated_id_requester = new mongoose.Types.ObjectId(requester_id);

    const requester = await db.collection('users').findOne(
      { _id: formated_id_requester },
      { projection: { name: 1, email: 1, telefono: 1, _id: 0 } }
    );

    if (!requester) {
      throw new Error("Requester details not found in users collection.");
    }

    return {
      requester_name: requester.name || 'Cliente',
      requester_email: requester.email || null,
      telefono: requester.telefono || null,
    };

  } catch (err) {
    console.error('Error fetching requester details:', err.message);
    throw new Error('No se pudo obtener el Requester para notificación.');
  }
}