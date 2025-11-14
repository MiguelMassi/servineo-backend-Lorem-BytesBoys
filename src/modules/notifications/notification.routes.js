import { Router } from 'express';
import * as NotificationController from './notification.controller.js';

const router = Router();

// GET /api/notifications - Obtiene todas las notificaciones
router.get('/', NotificationController.getAllNotificationsController);

// GET /api/notifications/tipo/:tipo - Obtiene notificaciones por tipo
router.get(
  '/tipo/:notification_type',
  NotificationController.getNotificationsByTypeController
);

// PATCH /api/notifications/:id/leido - Marca una notificación como leída
router.patch('/:id/leido', NotificationController.markNotificationAsReadController);

export default router;
