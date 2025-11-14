import { Router } from 'express';
import {
  getRequesterSchedulesByFixerMonth,
  getAllRequesterSchedulesByFixerMonth,
  getAppointmentsByDate,
  getModalFormAppointment,
  getMeetingStatus,
  getRequesterSchedulesByFixerDay,
  getOtherRequesterSchedulesByFixerDay,
  getAppointmentByFixerIdHour,
  getFixerAvailability,
  getAppointmentsByFixerIdAndDate,
  getCancelledSchedulesByRequesterDay,
  getCancelledSchedulesByFixerDay,
  getSixMonthsAppointments,
  getNumberOfAppointments
} from './read_controller.js';

const router = Router();

// Rutas para Schedules - Por mes
// * Fixed endpoint Chamo
router.get('/schedules/get_by_fixer_current_requester_month', getRequesterSchedulesByFixerMonth);
// * Fixed ndpoint Chamo (consultar)
router.get('/schedules/get_by_fixer_other_requesters_month', getAllRequesterSchedulesByFixerMonth);

// * Endpoints de rati ratone que no dice nada de lo que necesita...
router.get('/schedules/get_by_fixer_current_requester_day', getRequesterSchedulesByFixerDay);
// * Endpoints de rati ratone que no dice nada de lo que necesita...
router.get('/schedules/get_by_fixer_other_requesters_day', getOtherRequesterSchedulesByFixerDay);

// * Fixed Endpoint Arrick: Devolvia mucho 404.
// * Anteriores 2 endpoints unificados: se obtienen todas las citas de un dia 
// ? Inclue a todas las citas de todos los requesters en el dia
router.get('/appointments/get_appointments_date', getAppointmentsByDate);

// Ruta para Modal Form
// * Fixed Endpoint Pichon
router.get('/appointments/get_modal_form', getModalFormAppointment);

// * Fixed Endpoint Mateo: Reemplazar Body por query y verificar que funcione correctamente.
router.get('/appointments/get_meeting_status', getMeetingStatus);

router.get('/appointments/get_appointment_by_fixer_hour', getAppointmentByFixerIdHour);
router.get('/appointments/get_all_appointments_by_fixer_date', getAppointmentsByFixerIdAndDate);

router.get('/appointments/get_fixer_availability', getFixerAvailability);

// TODO: Endpoint que devuelve las citas canceladas por el propio requester que ve el calendario de un determinadon fixer en una fecha determinada.
router.get('/schedules/get_cancelled_appointments_by_requester_date', getCancelledSchedulesByRequesterDay);
// TODO: Endpoint que devuelve las citas canceladas por el fixer respecto a un determinado requester en una determinada fecha.
router.get('/schedules/get_cancelled_appointments_by_fixer_date', getCancelledSchedulesByFixerDay);

router.get('/schedules/get_six_months_appointments', getSixMonthsAppointments);

router.get('/schedules/get_number_of_appointments', getNumberOfAppointments);

export default router;