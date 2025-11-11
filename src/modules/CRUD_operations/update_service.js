import * as dotenv from 'dotenv';

import mongoose from 'mongoose';
import db_connection from '../../database.js';
import Appointment from '../../models/Appointment.js';

dotenv.config();

let connected = false;

async function set_db_connection() {
  if (!connected) {
    await db_connection();
    connected = true;
  }
}

// * Fixed Endpoint Pichon: Refactorizar y probar en Postman.
// * El endpoint estaba actualizando mas slots de los que deberia, ahora con el nuevo esquema actualiza lo solicitado.
async function update_appointment_by_id(id, attributes) {
  try {
    await set_db_connection();

    // * atributos hay que tener cuidado con schedule (ya no es necesario con el nuevo esquema).
    // * desestructurar schedule (ya no es necesario con el nuevo esquema).

    const updated_appointment = await Appointment.findByIdAndUpdate(
      id,
      { $set: attributes },
      { new: true },
    );

    if (updated_appointment) {
      return true;
    } else {
      return false;
    }
  } catch (err) {
    throw new Error(err.message);
  }
}

async function fixer_cancell_appointment_by_id(appointment_id) {
  try {
    await set_db_connection();
    const result = await Appointment.findByIdAndUpdate(appointment_id, {
      cancelled_fixer: true
    }, {
      new: true // <-- Devuelve el documento actualizado
    });
    if (!result) {
      throw new Error("Appointment no econtrado");
    }
    // MODIFICADO: Devolver el objeto completo
    return result; 
  } catch (error) {
    throw new Error(error.message);
  }
}

async function update_fixer_availability(fixer_id, availability) {
  try {
    const db = mongoose.connection.db;
    const result = await db.collection('users').updateOne(
      { _id: new mongoose.Types.ObjectId(fixer_id) },
      { $set: { availability: availability } }
    );
    return result;
  } catch (err) {
    throw new Error(err.message);
  }
}

// --- NUEVA FUNCIÓN AÑADIDA ---
// Función para contar cancelaciones consecutivas (Criterios 1 y 5)
async function get_consecutive_cancellation_count(fixer_id) {
  await set_db_connection();
  
  // Buscamos las citas del fixer, ordenadas por 'updatedAt' descendente.
  // 'updatedAt' refleja cuándo se realizó la acción de cancelar.
  const fixer_appointments = await Appointment.find({ 
    id_fixer: fixer_id 
  })
    .sort({ updatedAt: -1 })
    .limit(20); // Limitamos la búsqueda a un historial reciente

  let consecutive_cancellations = 0;

  for (const appt of fixer_appointments) {
    if (appt.cancelled_fixer === true) {
      consecutive_cancellations++;
    } else {
      // La racha se rompe si encontramos una no cancelada
      break; 
    }
  }
  return consecutive_cancellations;
}
// --- FIN DE NUEVA FUNCIÓN ---


export {
  update_appointment_by_id,
  update_fixer_availability,
  fixer_cancell_appointment_by_id,
  get_consecutive_cancellation_count // <-- Exportamos la nueva función
};