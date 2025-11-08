import express, { Router } from 'express'; // ← AGREGADO express
import cors from 'cors';
import LocationRoutes from '../modules/location/location.routes.js';
import CreateRoutes from '../modules/CRUD_operations/create_routes.js';
import ReadRoutes from '../modules/CRUD_operations/read_routes.js';
import UpdateRoutes from '../modules/CRUD_operations/update_routes.js';
import emailRoutes from '../modules/email/rutas.js';
// import HealthRoutes from '../modules/health/health.routes';

const Server = express();
const router = Router();

// CORS
Server.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:3000', 'http://localhost:5173'],
  credentials: true
}));

// Parsear JSON
Server.use(express.json());
Server.use(express.urlencoded({ extended: true }));

// Registrar rutas
// router.use('/api', HealthRoutes);
router.use('/api/location', LocationRoutes);
router.use('/api/crud_create', CreateRoutes);
router.use('/api/crud_read', ReadRoutes);
router.use('/api/crud_update', UpdateRoutes);
router.use('/api/email', emailRoutes); // ← Usar router en lugar de Server

// Ruta principal
Server.get('/', (req, res) => {
  res.json({ message: '✅ API Serviñeo funcionando correctamente' });
});

// Registrar todas las rutas en Server
Server.use(router);

// Manejador 404 (debe ir después de todas las rutas)
Server.use((req, res) => {
  console.log('Not found:', req.method, req.originalUrl);
  res.status(404).json({
    message: 'Ruta no encontrada',
    ruta: req.originalUrl
  });
});

export default Server;