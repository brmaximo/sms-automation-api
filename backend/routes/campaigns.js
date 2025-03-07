const express = require('express');
const router = express.Router();
const campaignController = require('../controllers/campaignController');
const authMiddleware = require('../middleware/auth');

// Rutas protegidas (requieren autenticación)
router.use(authMiddleware);

// Campañas
router.post('/', campaignController.createCampaign);
router.get('/', campaignController.getCampaigns);
router.get('/:id', campaignController.getCampaignById);
router.put('/:id', campaignController.updateCampaign);
router.delete('/:id', campaignController.deleteCampaign);

// Enviar QR por email
router.post('/:id/send-qr', campaignController.sendQRCodeByEmail);

// Obtener suscriptores de una campaña
router.get('/:id/subscribers', campaignController.getCampaignSubscribers);

module.exports = router;