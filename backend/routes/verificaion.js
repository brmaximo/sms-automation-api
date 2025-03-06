// routes/verification.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

// Verify email with token
router.get('/verify/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      if (decoded.type !== 'email_verification') {
        return res.status(400).json({ message: 'Token de verificación inválido' });
      }
      
      // Update user verified status
      await db.query('UPDATE users SET verified = TRUE WHERE id = $1', [decoded.id]);
      
      res.json({ message: 'Email verificado correctamente' });
    } catch (error) {
      return res.status(400).json({ message: 'Token inválido o expirado' });
    }
  } catch (error) {
    console.error('Error al verificar email:', error);
    res.status(500).json({ message: 'Error al verificar email' });
  }
});

// Resend verification email route
router.post('/resend', authMiddleware, async (req, res) => {
  try {
    // Check if already verified
    const userResult = await db.query(
      'SELECT verified FROM users WHERE id = $1',
      [req.user.id]
    );
    
    if (userResult.rows[0].verified) {
      return res.status(400).json({ message: 'Email ya verificado' });
    }
    
    // Create verification token
    const token = jwt.sign(
      { id: req.user.id, email: req.user.email, type: 'email_verification' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // In a real implementation, send email here
    console.log('Verification token created:', token);
    
    res.json({ 
      message: 'Email de verificación enviado',
      // Only in development - remove in production
      token: token
    });
  } catch (error) {
    console.error('Error al reenviar email:', error);
    res.status(500).json({ message: 'Error al reenviar email de verificación' });
  }
});

// Get verification status
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT verified FROM users WHERE id = $1',
      [req.user.id]
    );
    
    res.json({ verified: result.rows[0].verified });
  } catch (error) {
    console.error('Error al obtener estado de verificación:', error);
    res.status(500).json({ message: 'Error al obtener estado de verificación' });
  }
});

module.exports = router;