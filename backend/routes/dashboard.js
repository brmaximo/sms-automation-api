// En /routes/dashboard.js (nuevo archivo)
const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const authMiddleware = require('../middleware/auth');

// Aplicar middleware de autenticación
router.use(authMiddleware);

// Rutas para el dashboard
router.get('/stats', dashboardController.getDashboardStats);

module.exports = router;