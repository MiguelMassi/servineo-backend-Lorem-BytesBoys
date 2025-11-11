import app from '../src/config/server.config.js';
import { conectarMongo } from '../src/config/mongo.config.js';

// Conexión a Mongo al cold start de la función
await conectarMongo();

// Exporta el app de Express como handler de la función serverless
export default app;


