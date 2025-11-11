import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
    {
        appointment_id: {
            type: mongoose.Schema.Types.ObjectId, // Referencia al _id de la cita
            required: true,
            unique: false,
        },
        recipient_phone: { // Teléfono al que se envió
            type: String,
            required: true,
        },
        notification_type: {
            type: String,
            enum: [
                'whatsapp', 
                'email', 
                'sms', 
                'cancellation_warning', // <--- AÑADIDO
                'cancellation_warning_email_fallback' // <--- AÑADIDO
            ],
            required: true,
            default: 'whatsapp',
        },
        message_content: {
            type: String,
            required: true,
        },
        send_status: {
            type: String,
            enum: ['SUCCESS', 'FAILED', 'PENDING'],
            required: true,
        },
        error_details: {
            type: String,
            required: false,
            default: null,
        },
    },
    { timestamps: true },
);

// Mapeamos explícitamente a la colección 'notifications'
const Notification = mongoose.model('Notification', notificationSchema, 'notifications');

export default Notification;