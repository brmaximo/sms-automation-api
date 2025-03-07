const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const { sendEmail } = require('../emailService');
const { getVerificationEmailTemplate } = require('../emailTemplates');

// Generate verification token
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Send verification email
async function sendVerificationEmail(email, token) {
  // Create verification URL
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${token}`;
  
  // Get HTML content using the template
  const htmlContent = getVerificationEmailTemplate(verificationUrl);
  
  // Send email using Resend
  try {
    const result = await sendEmail(
      email,
      'Verifica tu correo electrónico',
      htmlContent
    );
    
    console.log(`Verification email sent to ${email}, Email ID: ${result.id}`);
    return result;
  } catch (error) {
    console.error(`Failed to send verification email to ${email}:`, error);
    throw error;
  }
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
    
    // Get user data to potentially send welcome email
    const userResult = await db.query(
      'SELECT name, email FROM users WHERE id = $1',
      [tokenData.user_id]
    );
    
    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      
      // Optionally send a welcome email now that the user is verified
      // This is not in the original code but can be a nice addition
      try {
        // If you've implemented the welcome email template
        // const welcomeUrl = `${process.env.FRONTEND_URL}/login`;
        // await sendEmail(
        //   user.email,
        //   `¡Bienvenido a SMS Automation, ${user.name}!`,
        //   getWelcomeEmailTemplate(user.name, welcomeUrl)
        // );
        console.log(`User ${tokenData.user_id} has successfully verified their email.`);
      } catch (welcomeEmailError) {
        // Don't fail verification if welcome email fails
        console.error('Failed to send welcome email:', welcomeEmailError);
      }
    }
    
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
    
    // Send verification email using Resend
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

// Additional helper route to manually verify a user (for admin or testing)
router.post('/manual-verify', authMiddleware, async (req, res) => {
  try {
    // This endpoint should be restricted to admin users in production
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Se requiere dirección de email' });
    }
    
    // Find user by email
    const userResult = await db.query(
      'SELECT id, verified FROM users WHERE email = $1',
      [email]
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
    
    // Mark user as verified
    await db.query(
      'UPDATE users SET verified = TRUE WHERE id = $1',
      [user.id]
    );
    
    res.json({ 
      message: 'Usuario verificado manualmente con éxito',
      verified: true
    });
  } catch (error) {
    console.error('Error manually verifying user:', error);
    res.status(500).json({ message: 'Error al verificar manualmente al usuario' });
  }
});

module.exports = router;