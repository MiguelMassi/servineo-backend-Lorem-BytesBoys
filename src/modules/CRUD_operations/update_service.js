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

// Define el límite de cancelaciones consecutivas
const CONSECUTIVE_CANCELLATION_LIMIT = 3;

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

    // 1. Encontrar la cita antes de modificarla
    const existing = await Appointment.findById(appointment_id);
    if (!existing) {
      throw new Error("Appointment no encontrado");
    }

    // 2. Manejar el caso de cita ya cancelada (modified: false)
    if (existing.cancelled_fixer === true) {
      // Aunque ya estaba cancelada, igual verificamos el conteo por si acaso
      const { consecutiveCount } = await checkConsecutiveCancellations(existing.id_fixer);

      return {
        modified: false,
        existing,
        warning_trigger: consecutiveCount >= CONSECUTIVE_CANCELLATION_LIMIT,
        cancellation_count: consecutiveCount,
        last_cancellation_date: existing.updatedAt
      };
    }

    // 3. Actualizar el campo cancelled_fixer
    const updated = await Appointment.findByIdAndUpdate(appointment_id, {
      cancelled_fixer: true
    }, {
      new: true
    });

    // 4. Verificar el conteo de cancelaciones consecutivas
    const { consecutiveCount } = await checkConsecutiveCancellations(updated.id_fixer);

    // 5. Devolver el resultado de la modificación junto con los datos de advertencia
    return {
      modified: true,
      existing: updated,
      warning_trigger: consecutiveCount >= CONSECUTIVE_CANCELLATION_LIMIT,
      cancellation_count: consecutiveCount,
      last_cancellation_date: updated.updatedAt // Fecha de la cancelación actual
    };
  } catch (error) {
    throw new Error(error.message);
  }
}

/**
 * Función auxiliar para contar cancelaciones consecutivas de un fixer.
 * Busca las citas más recientes y cuenta cuántas tienen 'cancelled_fixer: true'
 * hasta que encuentra una que no esté cancelada.
 */
async function checkConsecutiveCancellations(fixer_id) {
  await set_db_connection();

  // 1. Buscar todas las citas del fixer, ordenadas por la más reciente (usando updatedAt)
  const allAppointments = await Appointment.find({
    id_fixer: fixer_id
  }).sort({ updatedAt: -1 }); // La más reciente primero

  let consecutiveCount = 0;

  // 2. Iterar sobre las citas para contar las consecutivas
  for (const app of allAppointments) {
    if (app.cancelled_fixer === true) {
      consecutiveCount++;
    } else {
      // Se encontró una cita NO cancelada, se rompe la racha.
      break;
    }
  }

  return { consecutiveCount };
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

export {
  update_appointment_by_id,
  update_fixer_availability,
  fixer_cancell_appointment_by_id
};