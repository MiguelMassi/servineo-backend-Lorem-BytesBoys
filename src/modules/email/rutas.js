import express from 'express';
const router = express.Router();
import emailController from './controladores/emailController.js';
import emailValidatorController from './controladores/emailValidatorController.js';

// Ruta para enviar emails
router.post('/send', emailController.enviarEmail);

// Ruta para validar emails
router.post('/validate', emailValidatorController.validarEmail);

console.log('✅ Rutas de email registradas:');
console.log('   POST /api/email/send');
console.log('   POST /api/email/validate');

export default router;