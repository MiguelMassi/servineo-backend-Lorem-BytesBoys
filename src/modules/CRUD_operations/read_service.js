import * as dotenv from 'dotenv';
import db_connection from '../../database.js';
import Appointment from '../../models/Appointment.js';
import mongoose from 'mongoose';

dotenv.config();

let connected = false;

async function set_db_connection() {
  if (!connected) {
    await db_connection();
    connected = true;
  }
}

// TODO: CHAMO LOCURAS (Todos los occupied de un fixer_id, que NO vayan con el requester_id)
async function get_all_requester_schedules_by_fixer_month(fixer_id, requester_id, month) {
  await set_db_connection();
  const current_date = new Date();
  const current_year = current_date.getUTCFullYear();
  const target_month = parseInt(month) - 1; // Mongoose usa 0-indexed months
  const start_date = new Date(Date.UTC(current_year, target_month, 1, 0, 0, 0));
  const finish_date = new Date(Date.UTC(current_year, target_month + 1, 0, 23, 59, 59, 999));
  return Appointment.find(
    {
      id_fixer: fixer_id,
      id_requester: { $ne: requester_id },
      selected_date: {
        $gte: start_date,
        $lte: finish_date
      },
      cancelled_fixer: { $ne: true }
    },
    {
      starting_time: 1,
      finishing_time: 1,
      schedule_state: 1,
      appointment_description: 1,
      display_name_location: 1,
      lat: 1,
      lon: 1,
      _id: 1
    },
  );
}

// *: Fixed endpoint Chamo
async function get_requester_schedules_by_fixer_month(fixer_id, requester_id, month) {
  await set_db_connection();
  const current_date = new Date();
  const current_year = current_date.getUTCFullYear();
  const target_month = parseInt(month) - 1; // Mongoose usa 0-indexed months
  const start_date = new Date(Date.UTC(current_year, target_month, 1, 0, 0, 0));
  const finish_date = new Date(Date.UTC(current_year, target_month + 1, 0, 23, 59, 59, 999));
  return Appointment.find(
    {
      id_fixer: fixer_id,
      id_requester: requester_id,
      selected_date: {
        $gte: start_date,
        $lte: finish_date
      },
      cancelled_fixer: { $ne: true }
    },
    {
      starting_time: 1,
      finishing_time: 1,
      schedule_state: 1,
      appointment_description: 1,
      display_name_location: 1,
      lat: 1,
      lon: 1,
      _id: 1
    },
  );
}

// *: Fixed Endpoint Mateo: Reemplazar Body por query y verificar que funcione correctamente.
async function get_meeting_status(requester_id, fixer_id, current_date, start_hour) {
  try {
    await set_db_connection();
    const adjusted_date = new Date(current_date);
    const current_year = adjusted_date.getUTCFullYear();
    const current_month = adjusted_date.getUTCMonth();
    const current_day = adjusted_date.getUTCDate();
    const start_hour_num = parseInt(start_hour, 10);
    const starting_date = new Date(Date.UTC(current_year, current_month, current_day, start_hour_num, 0, 0));
    const finish_date = new Date(Date.UTC(current_year, current_month, current_day, (start_hour_num + 1), 0, 0));

    const appointment = await Appointment.findOne({
      id_requester: requester_id,
      id_fixer: fixer_id,
      starting_time: {
        $gte: starting_date,
        $lt: finish_date
      }
    });
    if (!appointment) {
      return { name: "", status: 'available' };
    } else {
      return { name: appointment.current_requester_name, status: appointment.schedule_state };
    }
  } catch (err) {
    throw new Error(err.message);
  }
}

// * Fixed Endpoint Arrick: Devolvia mucho 404.
// * Anteriores 2 endpoints unificados: se obtienen todas las citas de un dia 
// ? Incluye a todas las citas de todos los requesters en el dia
async function get_appointments_by_fixer_day(fixer_id, requested_date) {
  try {
    await set_db_connection();
    const founded_appointments = await Appointment.find({
      id_fixer: fixer_id,
      selected_date: requested_date,
    });
    if (!founded_appointments) {
      throw new Error("Not appointments founded");
    }
    return { appointments: founded_appointments };
  } catch (err) {
    throw new Error(err.message);
  }
}

// * Fixear Endpoint Pichon: -
async function get_modal_form_appointment(fixer_id, requester_id, appointment_date, start_hour) {
  try {
    await set_db_connection();

    const current_year = appointment_date.getUTCFullYear();
    const current_month = appointment_date.getUTCMonth();
    const current_day = appointment_date.getUTCDate();

    const exact_start_date = new Date(Date.UTC(current_year, current_month, current_day, start_hour, 0, 0));
    const appointment = await Appointment.findOne({
      id_fixer: fixer_id,
      id_requester: requester_id,
      starting_time: exact_start_date
    });

    if (!appointment) {
      throw new Error("Appointment does not exist.");
    };

    return {
      _id: appointment._id,
      id_fixer: appointment.id_fixer,
      id_requester: appointment.id_requester,
      current_requester_name: appointment.current_requester_name,
      appointment_type: appointment.appointment_type,
      appointment_description: appointment.appointment_description,
      link_id: appointment.link_id,
      current_requester_phone: appointment.current_requester_phone,
      display_name_location: appointment.display_name_location,
      latitude: appointment.lat,
      longitude: appointment.lon,
    };
  } catch (err) {
    throw new Error(err.message);
  }
}

// * Endpoints de rati ratone que no dice nada de lo que necesita...
async function get_requester_schedules_by_fixer_day(fixer_id, requester_id, searched_date) {
  await set_db_connection();
  const current_date = new Date(searched_date);
  const current_year = current_date.getUTCFullYear();
  const current_month = current_date.getUTCMonth();
  const current_day = current_date.getUTCDate();
  const start_date = new Date(Date.UTC(current_year, current_month, current_day, 0, 0, 0));
  const finish_date = new Date(Date.UTC(current_year, current_month, current_day, 23, 59, 59, 999));
  const daily_appointments = await Appointment.find(
    {
      id_fixer: fixer_id,
      id_requester: requester_id,
      selected_date: {
        $gte: start_date,
        $lte: finish_date
      },
      cancelled_fixer: { $ne: true }
    },
    {
      starting_time: 1,
      finishing_time: 1,
      schedule_state: 1,
    }, { new: true });

  const formated_appointments = [];
  for (let appointment of daily_appointments) {
    const start_hour = appointment.starting_time.getUTCHours();
    const finish_hour = appointment.finishing_time.getUTCHours();
    formated_appointments.push({
      starting_hour: start_hour,
      finishing_hour: finish_hour,
      schedule_state: 'booked'
    });
  }
  return formated_appointments;
}

// * Endpoints de rati ratone que no dice nada de lo que necesita...
async function get_other_requester_schedules_by_fixer_day(fixer_id, requester_id, searched_date) {
  await set_db_connection();
  const current_date = new Date(searched_date);
  const current_year = current_date.getUTCFullYear();
  const current_month = current_date.getUTCMonth();
  const current_day = current_date.getUTCDate();
  const start_date = new Date(Date.UTC(current_year, current_month, current_day, 0, 0, 0));
  const finish_date = new Date(Date.UTC(current_year, current_month, current_day, 23, 59, 59, 999));
  const daily_appointments = await Appointment.find(
    {
      id_fixer: fixer_id,
      id_requester: { $ne: requester_id },
      selected_date: {
        $gte: start_date,
        $lte: finish_date
      },
      cancelled_fixer: { $ne: true }
    },
    {
      starting_time: 1,
      finishing_time: 1,
      schedule_state: 1,
    }, { new: true });

  const formated_appointments = [];
  for (let appointment of daily_appointments) {
    const start_hour = appointment.starting_time.getUTCHours();
    const finish_hour = appointment.finishing_time.getUTCHours();
    formated_appointments.push({
      starting_hour: start_hour,
      finishing_hour: finish_hour,
      schedule_state: 'occupied'
    });
  }
  return formated_appointments;
}

async function get_appointment_by_fixer_id_hour(fixer_id, date, hour) {
  try {
    await set_db_connection();
    const hourInt = parseInt(hour);
    hour = hourInt < 10 ? ('0' + hourInt) : '' + hourInt;
    const appointmentDate = new Date(`${date}T${hour}:00:00.000Z`);
    const appointment = await Appointment.find({
      id_fixer: fixer_id,
      starting_time: appointmentDate,
    });
    return appointment;
  } catch (error) {
    throw new Error(error.message);
  }
}

async function get_fixer_availability(fixer_id) {
  const db = mongoose.connection.db;
  const fixer = await db.collection('users').findOne(
    { _id: new mongoose.Types.ObjectId(fixer_id) },
    { projection: { availability: 1, _id: 0 } }
  );
  if (!fixer) {
    throw new Error("Fixer not found.");
  }
  let availability;
  // la vdd no se cual funciona bien asi que puse ambosxd
  if (!('availability' in fixer) || !fixer.availability) {
    availability = {
      lunes: [8, 9, 10, 11, 14, 15, 16, 17],
      martes: [8, 9, 10, 11, 14, 15, 16, 17],
      miercoles: [8, 9, 10, 11, 14, 15, 16, 17],
      jueves: [8, 9, 10, 11, 14, 15, 16, 17],
      viernes: [8, 9, 10, 11, 14, 15, 16, 17],
      sabado: [],
      domingo: []
    };
  } else {
    availability = fixer.availability;
  }
  return availability;
}

export async function get_appointments_by_fixer_id_date(fixer_id, date) {
  try {
    const [year, month] = date.split('-').map(Number);
    const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
    const endOfMonth = new Date(Date.UTC(year, month, 1));
    const appointments = await Appointment.find({
      id_fixer: fixer_id,
      selected_date: {
        $gte: startOfMonth,
        $lt: endOfMonth
      },
      cancelled_fixer: false
    }).sort({ selected_date: 1, starting_time: 1 });
    return appointments;
  } catch (error) {
    throw new Error(error.message);
  }
}

// TODO: Endpoint que devuelve las citas canceladas por el propio requester que ve el calendario de un determinadon fixer en una fecha determinada.
export async function get_cancelled_schedules_by_requester_day(fixer_id, requester_id, searched_date) {
  try {
    await set_db_connection();
    const current_date = new Date(searched_date);
    const current_year = current_date.getUTCFullYear();
    const current_month = current_date.getUTCMonth();
    const current_day = current_date.getUTCDate();
    const starting_date = new Date(Date.UTC(current_year, current_month, current_day, 0, 0, 0));
    const finish_date = new Date(Date.UTC(current_year, current_month, current_day, 23, 59, 59, 999));
    const cancelled_appointments_requester = await Appointment.find(
      {
        id_fixer: fixer_id,
        id_requester: requester_id,
        selected_date: {
          $gte: starting_date,
          $lte: finish_date
        },
        schedule_state: 'cancelled',
        cancelled_fixer: false
      },
      {
        starting_time: 1,
        finishing_time: 1,
        schedule_state: 1
      }, { new: true });

    const formated_appointments = [];
    for (let cancelled_appointment of cancelled_appointments_requester) {
      const start_hour = cancelled_appointment.starting_time.getUTCHours();
      const finish_hour = cancelled_appointment.finishing_time.getUTCHours();
      const current_appointment_state = cancelled_appointment.schedule_state;
      formated_appointments.push({
        starting_hour: start_hour,
        finishing_hour: finish_hour,
        schedule_state: current_appointment_state
      });
    }
    return formated_appointments;
  } catch (err) {
    throw new Error(err.message);
  }
}

// TODO: Endpoint que devuelve las citas canceladas por el fixer respecto a un determinado requester en una determinada fecha.
export async function get_cancelled_schedules_by_fixer_day(fixer_id, requester_id, searched_date) {
  try {
    await set_db_connection();
    const current_date = new Date(searched_date);
    const current_year = current_date.getUTCFullYear();
    const current_month = current_date.getUTCMonth();
    const current_day = current_date.getUTCDate();
    const start_date = new Date(Date.UTC(current_year, current_month, current_day, 0, 0, 0));
    const finish_date = new Date(Date.UTC(current_year, current_month, current_day, 23, 59, 59, 999));
    const cancelled_appointments_fixer = await Appointment.find(
      {
        id_fixer: fixer_id,
        id_requester: requester_id,
        selected_date: {
          $gte: start_date,
          $lte: finish_date
        },
        cancelled_fixer: true,
        schedule_state: {
          $ne: 'cancelled'
        }
      },
      {
        starting_time: 1,
        finishing_time: 1,
        cancelled_fixer: 1,
        schedule_state: 1
      }, { new: true });

    const formated_appointments = []
    for (let cancelled_appointment of cancelled_appointments_fixer) {
      const start_hour = cancelled_appointment.starting_time.getUTCHours();
      const finish_hour = cancelled_appointment.finishing_time.getUTCHours();
      const wasCanceelledByFixer = cancelled_appointment.cancelled_fixer;
      const current_appointment_state = cancelled_appointment.schedule_state;
      formated_appointments.push({
        starting_hour: start_hour,
        finishing_hour: finish_hour,
        schedule_state: current_appointment_state,
        cancelled_fixer: wasCanceelledByFixer
      });
    }
    return formated_appointments;
  } catch (err) {
    throw new Error(err.message);
  }
}

export async function get_six_months_appointments(fixer_id, date) {
  try {
    await set_db_connection();
    const actualDate = new Date(date);
    const month = actualDate.getMonth();
    const year = actualDate.getFullYear();
    const lastDay = new Date(year, month + 6, 0).getDate();

    const lastMonth = month + 6;
    const finish_date = new Date(Date.UTC(year, lastMonth, lastDay, 23, 59, 59, 999));

    console.log(finish_date);
    const appointments = Appointment.find({
      id_fixer: fixer_id,
      selected_date: {
        $gte: actualDate,
        $lte: finish_date
      },
    })

    return appointments;

  } catch (err) {
    throw new Error(err.message);
  }
}

export async function get_number_of_appointments(fixer_id, month, year) {
  try {
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month, 0).getDate();

    console.log(startOfMonth, endOfMonth);
    const result = await Appointment.aggregate([
      {
        $match: {
          id_fixer: fixer_id,
          selected_date: {
            $gte: startOfMonth,
            $lt: endOfMonth
          },
          cancelled_fixer: false
        }
      },
      {
        $group: {
          _id: { $dayOfMonth: "$selected_date" },
          count: { $sum: 1 }
        }
      }
    ]);

    const countMap = new Map();
    result.forEach(item => {
      countMap.set(item._id, item.count);
    });

    const appointmentsByDay = {};
    for (let day = 1; day <= daysInMonth; day++) {
      appointmentsByDay[day] = countMap.get(day) || 0;
    }

    return appointmentsByDay;
  } catch (error) {
    throw new Error(error.message);
  }
}

export {
  get_all_requester_schedules_by_fixer_month,
  get_requester_schedules_by_fixer_month,
  get_appointments_by_fixer_day,
  get_modal_form_appointment,
  get_meeting_status,
  get_requester_schedules_by_fixer_day,
  get_other_requester_schedules_by_fixer_day,
  get_appointment_by_fixer_id_hour,
  get_fixer_availability,
};
