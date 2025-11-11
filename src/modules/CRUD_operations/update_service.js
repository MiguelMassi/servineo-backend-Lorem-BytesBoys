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
    
    // 1. Encontrar la cita antes de modificarla
    const existing = await Appointment.findById(appointment_id);
    if (!existing) {
      throw new Error("Appointment no encontrado");
    }

    // 2. Manejar el caso de cita ya cancelada (modified: false)
    if (existing.cancelled_fixer === true) {
        return { modified: false, existing };
    }

    // 3. Actualizar el campo cancelled_fixer
    const updated = await Appointment.findByIdAndUpdate(appointment_id, {
      cancelled_fixer: true
    }, {
      new: true
    });
    
    // 4. Devolver el resultado de la modificación junto con el objeto de la cita
    return { modified: true, existing: updated }; 
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

export {
  update_appointment_by_id,
  update_fixer_availability,
  fixer_cancell_appointment_by_id
};
