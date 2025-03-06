const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

// Generate verification token
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Send verification email
async function sendVerificationEmail(email, token) {
  // Configure transporter
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });

  // Create verification URL
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${token}`;

  // Send email
  await transporter.sendMail({
    from: `"SMS Automation" <${process.env.EMAIL_FROM}>`,
    to: email,
    subject: 'Verifica tu correo electrónico',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Verifica tu dirección de correo electrónico</h2>
        <p>Haz clic en el siguiente enlace para verificar tu correo electrónico:</p>
        <p><a href="${verificationUrl}" style="background-color: #4a69bd; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px;">Verificar mi correo</a></p>
        <p>O copia y pega este enlace en tu navegador:</p>
        <p>${verificationUrl}</p>
        <p>Este enlace expirará en 24 horas.</p>
      </div>
    `
  });
}

// PUBLIC ENDPOINT: Verify email with token
router.get('/verify/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    // Find token in database
    const tokenResult = await db.query(
      'SELECT * FROM verification_tokens WHERE token = $1 AND expires_at > NOW()',
      [token]
    );
    
    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ 
        message: 'Token de verificación inválido o expirado' 
      });
    }
    
    const tokenData = tokenResult.rows[0];
    
    // Mark user as verified
    await db.query(
      'UPDATE users SET verified = TRUE WHERE id = $1',
      [tokenData.user_id]
    );
    
    // Delete used token
    await db.query(
      'DELETE FROM verification_tokens WHERE id = $1',
      [tokenData.id]
    );
    
    // Redirect to frontend success page or return success message
    res.json({ 
      message: 'Email verificado correctamente',
      verified: true
    });
  } catch (error) {
    console.error('Error verifying email:', error);
    res.status(500).json({ message: 'Error al verificar el email' });
  }
});

// PROTECTED ENDPOINT: Request new verification email
router.post('/resend', authMiddleware, async (req, res) => {
  try {
    // Get user info from auth middleware
    const userId = req.user.id;
    
    // Get user email
    const userResult = await db.query(
      'SELECT email, verified FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    const user = userResult.rows[0];
    
    // Check if already verified
    if (user.verified) {
      return res.status(400).json({ 
        message: 'El correo ya está verificado',
        verified: true
      });
    }
    
    // Delete any existing tokens for this user
    await db.query(
      'DELETE FROM verification_tokens WHERE user_id = $1',
      [userId]
    );
    
    // Generate new token
    const token = generateToken();
    
    // Set expiration (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    // Save token to database
    await db.query(
      'INSERT INTO verification_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [userId, token, expiresAt]
    );
    
    // Send verification email
    await sendVerificationEmail(user.email, token);
    
    res.json({ 
      message: 'Correo de verificación enviado correctamente' 
    });
  } catch (error) {
    console.error('Error resending verification email:', error);
    res.status(500).json({ 
      message: 'Error al enviar el correo de verificación' 
    });
  }
});

module.exports = router;