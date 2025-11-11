import Notification from './notification.model.js';

/**
 * Obtiene todas las notificaciones
 */
export async function getAllNotificationsController(_req, res) {
  try {
    // Ordenadas por fecha descendente (más recientes primero)
    const notifications = await Notification.find().sort({ creado: -1 });

    return res.status(200).json(notifications);
  } catch (error) {
    console.error('Error al obtener notificaciones:', error);
    return res.status(500).json({
      message: 'Error al obtener notificaciones',
      error: error.message,
    });
  }
}

/**
 * Obtiene notificaciones por su tipo
 */
export async function getNotificationsByTypeController(req, res) {
  try {
    const { notification_type } = req.params;

    const notifications = await Notification.find({
      notification_type: notification_type,
    }).sort({ creado: -1 });

    if (notifications.length === 0) {
      return res.status(404).json({
        message: `No se encontraron notificaciones del tipo '${notification_type}'.`,
      });
    }

    return res.status(200).json(notifications);
  } catch (error) {
    console.error('Error al obtener notificaciones por tipo:', error);
    return res.status(500).json({
      message: 'Error al obtener notificaciones por tipo',
      error: error.message,
    });
  }
}

/**
 * Marca una notificación como leída
 */
export async function markNotificationAsReadController(req, res) {
  try {
    const { id } = req.params;

    const notification = await Notification.findByIdAndUpdate(
      id,
      { leido: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: 'Notificación no encontrada' });
    }

    return res.status(200).json(notification);
  } catch (error) {
    console.error('Error al marcar la notificación como leída:', error);
    return res.status(500).json({
      message: 'Error al marcar la notificación como leída',
      error: error.message,
    });
  }
}
