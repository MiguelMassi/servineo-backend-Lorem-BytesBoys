import mongoose from 'mongoose';

const { Schema } = mongoose;

// Esquema de Mongoose
const NotificationSchema = new Schema(
  {
    appointment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
    users_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    recipient_phone: { type: String },
    notification_type: { type: String, enum: ['whatsapp', 'email'] },
    message_content: { type: String },
    send_status: { type: String, enum: ['SUCCESS', 'FAILED', 'PENDING'] },
    error_details: { type: String, default: null },
    leido: { type: Boolean, default: false, required: true },
    // Campos adicionales opcionales
    tipo: { type: String },
    estado: { type: String },
  },
  {
    timestamps: true, // crea createdAt y updatedAt automáticamente
    strict: false, // permite campos adicionales sin definir
  }
);

// Modelo de Mongoose
const Notification = mongoose.model('Notification', NotificationSchema);

export default Notification;
