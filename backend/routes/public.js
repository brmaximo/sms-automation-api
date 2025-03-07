const express = require('express');
const router = express.Router();
const campaignController = require('../controllers/campaignController');

// Rutas públicas (no requieren autenticación)
router.get('/campaigns/:id', campaignController.getPublicCampaign);
router.post('/campaigns/:campaignId/subscribe', campaignController.addSubscriber);

module.exports = router;