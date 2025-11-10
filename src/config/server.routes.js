import { Router } from 'express';
import LocationRoutes from '../modules/location/location.routes.js';
import CreateRoutes from '../modules/CRUD_operations/create_routes.js';
import ReadRoutes from '../modules/CRUD_operations/read_routes.js';
import UpdateRoutes from '../modules/CRUD_operations/update_routes.js';
import emailRoutes from '../modules/email/rutas.js';
// import HealthRoutes from '../modules/health/health.routes';

const router = Router();

// router.use('/api', HealthRoutes);
router.use('/api/location', LocationRoutes);
router.use('/api/crud_create', CreateRoutes);
router.use('/api/crud_read', ReadRoutes);
router.use('/api/crud_update', UpdateRoutes);
router.use('/api/email', emailRoutes);

router.use((req, res) => {
  console.log('Not found:', req.method, req.originalUrl);
  res.status(404).send({
    message: 'route not found',
  });
});

export default router;
