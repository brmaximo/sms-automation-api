const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/scheduleController');
const authMiddleware = require('../middleware/auth');

// Rutas protegidas (requieren autenticación)
router.use(authMiddleware);

// Programaciones de campañas
router.post('/', scheduleController.scheduleMarketing);
router.get('/', scheduleController.getSchedules);
router.post('/:id/cancel', scheduleController.cancelSchedule);
router.post('/:id/execute', scheduleController.executeSchedule);

module.exports = router;