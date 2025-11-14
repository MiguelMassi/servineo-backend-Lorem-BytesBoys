// read_controller.js
import 'express';
import {
  get_all_requester_schedules_by_fixer_month,
  get_requester_schedules_by_fixer_month,
  get_appointments_by_fixer_day,
  get_meeting_status,
  get_modal_form_appointment,
  get_requester_schedules_by_fixer_day,
  get_other_requester_schedules_by_fixer_day,
  get_appointment_by_fixer_id_hour,
  get_fixer_availability,
  get_appointments_by_fixer_id_date,
  get_cancelled_schedules_by_requester_day,
  get_cancelled_schedules_by_fixer_day,
  get_six_months_appointments,
  get_number_of_appointments
} from './read_service.js'; // llamamos al service

// Obtener horarios de un requester en un mes específico
// TODO: fix, controladores deben devolver siempre status codes, dataExists no debe existir
// * FIXED Endpoint Chamo: -
export async function getRequesterSchedulesByFixerMonth(req, res) {
  try {
    const { fixer_id, requester_id, month } = req.query;
    if (!fixer_id) {
      res.status(400).json({ message: 'Missing required query parameters: fixer_id.' });
      return;
    }
    if (!requester_id) {
      res.status(400).json({ message: 'Missing required query parameters: requester_id.' });
      return;
    }
    if (!month) {
      res.status(400).json({ message: 'Missing required query parameters: month.' });
      return;
    }
    const data = await get_requester_schedules_by_fixer_month(fixer_id, requester_id, month);
    res.status(200).json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching requester schedules by fixer and month.' });
  }
}

// TODO: fix, controladores deben devolver siempre status codes, dataExists no debe existir
export async function getAllRequesterSchedulesByFixerMonth(req, res) {
  try {
    const { fixer_id, requester_id, month } = req.query;
    if (!fixer_id) {
      res.status(400).json({ message: 'Missing required query parameters: fixer_id.' });
      return;
    }
    if (!requester_id) {
      res.status(400).json({ message: 'Missing required query parameters: requester_id.' });
      return;
    }
    if (!month) {
      res.status(400).json({ message: 'Missing required query parameters: month.' });
      return;
    }
    const data = await get_all_requester_schedules_by_fixer_month(fixer_id, requester_id, month);
    res.status(200).json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching all requester schedules by fixer and month.' });
  }
}

// * Fixed Endpoint Arrick: Devolvia mucho 404.
// * Anteriores 2 endpoints unificados: se obtienen todas las citas de un dia 
// ? Inclue a todas las citas de todos los requesters en el dia
export async function getAppointmentsByDate(req, res) {
  try {
    const { id_fixer, selected_date } = req.query;
    if (!id_fixer || !selected_date) {
      return res.status(400).json({
        success: false,
        message: 'Missing parameter: required fixer id or selected date'
      });
    }
    const { appointments } = await get_appointments_by_fixer_day(id_fixer, selected_date);
    return res.status(200).json({
      success: true,
      message: 'Appointments for the selected date successfully accessed',
      accessed_appointments: appointments
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Error accessing appointments for the selected date.',
      error: err.message
    });
  }
}

//TODO: Fixear Endpoint Arrick: Unificar con el endpoint de arriba.
export async function getAllRequesterSchedulesByFixerDay(req, res) {
  try {
    const { fixer_id, requester_id, searched_date } = req.query;

    if (!fixer_id) {
      return res.status(400).json({ message: 'Missing required query parameters: fixer_id.' });
    }
    if (!requester_id) {
      return res.status(400).json({ message: 'Missing required query parameters: requester_id.' });
    }
    if (!searched_date) {
      return res.status(400).json({ message: 'Missing required query parameters: searched_date.' });
    }

    const date = new Date(searched_date);
    if (isNaN(date.getTime())) {
      return res.status(400).json({ message: 'Invalid date format for searched_date.' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching all requester schedules by fixer and day.' });
  }
}

// * Fixed Endpoint Pichon: -
export async function getModalFormAppointment(req, res) {
  try {
    const { fixer_id, requester_id, appointment_date, start_hour } = req.query;
    console.log(req.query);
    if (!fixer_id || !requester_id || !appointment_date || !start_hour) {
      return res.status(400).json({ message: 'Missing parameter: required fixer_id, requester_id, appointment_date and start_hour' })
    }

    const date = new Date(appointment_date);
    if (isNaN(date.getTime())) {
      return res.status(400).json({ message: 'Invalid date format for appointment_date.' });
    }

    const hour = parseInt(start_hour);
    if (isNaN(hour) || hour < 0 || hour > 23) {
      return res.status(400).json({ message: 'Invalid start_hour. Must be between 0 and 23.' });
    }

    const data = await get_modal_form_appointment(fixer_id, requester_id, date, hour);

    if (!data) {
      return res.status(404).json({ message: 'No appointment found for the specified parameters.' });
    }

    return res.status(200).json({
      message: 'Appointment modal data found.',
      data: data
    });

  } catch (error) {
    console.error(error);

    if (error.message === "Appointment does not exist.") {
      return res.status(404).json({ message: error.message });
    }

    res.status(500).json({ message: 'Error fetching modal form appointment data.' });
  }
}

// * Fixed Endpoint Mateo: Reemplazar Body por query y verificar que funcione correctamente.
export async function getMeetingStatus(req, res) {
  try {
    const { id_requester, id_fixer, selected_date, starting_time } = req.query;
    console.log(req.query);
    if (!id_requester || !id_fixer || !selected_date || !starting_time) {
      return res.status(400).json({ message: 'Missing parameters: required requester id, fixer id, date or starting hour' });
    }
    const { name, status } = await get_meeting_status(id_requester, id_fixer, selected_date, starting_time);
    console.log(name, status);
    return res.status(200).json({ message: 'Meeting status successfully accessed', name, status });
  } catch (err) {
    return res.status(500).json({ message: 'Error updating appointment data', name: "", status: "", error: err.message });
  }
}

// * Endpoints de rati ratone que no dice nada de lo que necesita...
export async function getRequesterSchedulesByFixerDay(req, res) {
  try {
    const { fixer_id, requester_id, searched_date } = req.query;
    if (!fixer_id || !requester_id || !searched_date) {
      return res.status(400).json({ message: 'Missing required query parameters: fixer_id, requester_id or searched_date.' });
    }
    const data = await get_requester_schedules_by_fixer_day(fixer_id, requester_id, searched_date);
    return res.status(200).json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error fetching requester schedules by fixer and day.' });
  }
}

// * Endpoints de rati ratone que no dice nada de lo que necesita...
export async function getOtherRequesterSchedulesByFixerDay(req, res) {
  try {
    const { fixer_id, requester_id, searched_date } = req.query;
    if (!fixer_id || !requester_id || !searched_date) {
      return res.status(400).json({ message: 'Missing required query parameters: fixer_id, requester_id or searched_date.' });
    }
    const data = await get_other_requester_schedules_by_fixer_day(fixer_id, requester_id, searched_date);
    return res.status(200).json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error fetching all requester schedules by fixer and day.' });
  }
}

export async function getAppointmentByFixerIdHour(req, res) {
  try {
    const { fixer_id, date, hour } = req.query;
    if (!fixer_id || !date || !hour) {
      return res.satus(400).json({
        succeed: false,
        message: "Missing query parameters"
      });
    }
    const data = await get_appointment_by_fixer_id_hour(fixer_id, date, hour);
    res.status(200).json({
      succeed: true,
      message: data ? "Appointment found" : "Appoitment not found",
      appointment: data
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      succeed: false,
      message: "Error fetching appointment"
    });
  }
}

export async function getFixerAvailability(req, res) {
  const { fixer_id } = req.query;
  if (!fixer_id) {
    return res.status(400).json({ message: 'Missing parameter: required fixer_id' });
  }
  try {
    const data = await get_fixer_availability(fixer_id);
    return res.status(200).json({ message: 'Fixer availability fetched successfully', availability: data });
  } catch (err) {
    return res.status(500).json({ message: 'Error fetching fixer availability: ' + err.message });
  }
}

export async function getAppointmentsByFixerIdAndDate(req, res) {
  try {
    const { id_fixer, date } = req.query;
    if (!id_fixer || !date) {
      return res.status(400).json({
        succeed: false,
        message: "Missing query parameters"
      });
    }
    const appointments = await get_appointments_by_fixer_id_date(id_fixer, date);
    res.status(200).json({
      succeed: true,
      message: "Appointments fetched succesfully",
      appointments
    });
  } catch (error) {
    res.status(500).json({
      succeed: false,
      message: "Error fetching appointments",
      error: error.message
    });
  }
}

// TODO: Endpoint que devuelve las citas canceladas por el propio requester que ve el calendario de un determinadon fixer en una fecha determinada.
export async function getCancelledSchedulesByRequesterDay(req, res) {
  try {
    const { fixer_id, requester_id, searched_date } = req.query;
    if (!fixer_id || !requester_id || !searched_date) {
      return res.status(400).json({ message: 'Missing required query parameters: fixer_id, requester_id or searched_date.' });
    }
    const data = await get_cancelled_schedules_by_requester_day(fixer_id, requester_id, searched_date);
    if (!data) {
      return res.status(400).json({
        message: 'Could not find any cancelled schedule by the requester on this date.'
      });
    } else {
      return res.status(200).json({
        cancelled_schedules_requester: data,
        message: 'Cancelled schedules by requester accessed successfully.'
      });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error fetching cancelled schedules by requester.' })
  }
}

// TODO: Endpoint que devuelve las citas canceladas por el fixer respecto a un determinado requester en una determinada fecha.
export async function getCancelledSchedulesByFixerDay(req, res) {
  try {
    const { fixer_id, requester_id, searched_date } = req.query;
    if (!fixer_id || !requester_id || !searched_date) {
      return res.status(400).json({ message: 'Missing required query parameters: fixer_id, requester_id or searched_date.' });
    }
    const data = await get_cancelled_schedules_by_fixer_day(fixer_id, requester_id, searched_date);
    if (!data) {
      return res.status(400).json({
        message: 'Could not find any cancelled schedule by the fixer on this date.'
      });
    } else {
      return res.status(200).json({
        cancelled_schedules_fixer: data,
        message: 'Cancelled schedules by fixer accessed successfully.'
      });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Error fetching cancelled schedules by fixer.' })
  }
}

export async function getSixMonthsAppointments(req, res) {
  try {
    const { fixer_id, date } = req.query;
    console.log(req.query);
    if (!fixer_id || !date) {
      return res.status(500).json({ message: 'Parameter fixer_id and date are required' });
    }
    const data = await get_six_months_appointments(fixer_id, date);
    return res.status(200).json({
      message: 'Six months appointments fetched successfully',
      appointments: data
    });
  } catch (err) {
    return res.status(500).json({ message: 'Error fetching data: ' + err.message });
  }
}

export async function getNumberOfAppointments(req, res) {
  try {
    const { fixer_id, month, year } = req.query;
    if (!fixer_id || !month || !year) {
      return res.status(500).json({ message: 'Parameter fixer_id, month and year are required' });
    }
    const data = await get_number_of_appointments(fixer_id, month, year);
    return res.status(200).json({
      message: 'Number of appointments fetched successfully',
      number_of_appointments: data
    });
  } catch (err) {
    return res.status(500).json({ message: 'Error fetching data: ' + err.message });
  }
}