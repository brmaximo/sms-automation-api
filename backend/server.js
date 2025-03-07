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
    console.log(`Attempting to send verification email to: ${email}`);
    
    const result = await sendEmail(
      email,
      'Verifica tu correo electrónico',
      htmlContent
    );
    
    console.log(`Verification email sent to ${email}, Email ID: ${result.id}`);
    return result;
  } catch (error) {
    console.error(`Failed to send verification email to ${email}:`, error);
    console.error('Error details:', error.message);
    // Log additional error info if available
    if (error.response) {
      console.error('API Response:', error.response);
    }
    throw error;
  }
}

// PUBLIC ENDPOINT: Verify email with token
router.get('/verify/:token', async (req, res) => {
  try {
    const { token } = req.params;
    console.log(`Processing verification for token: ${token}`);
    
    // Find token in database
    const tokenResult = await db.query(
      'SELECT * FROM verification_tokens WHERE token = $1 AND expires_at > NOW()',
      [token]
    );
    
    if (tokenResult.rows.length === 0) {
      console.log('Invalid or expired token');
      return res.status(400).json({ 
        message: 'Token de verificación inválido o expirado' 
      });
    }
    
    const tokenData = tokenResult.rows[0];
    console.log(`Found valid token for user ID: ${tokenData.user_id}`);
    
    // Mark user as verified
    await db.query(
      'UPDATE users SET verified = TRUE WHERE id = $1',
      [tokenData.user_id]
    );
    console.log(`User ${tokenData.user_id} marked as verified`);
    
    // Delete used token
    await db.query(
      'DELETE FROM verification_tokens WHERE id = $1',
      [tokenData.id]
    );
    console.log('Verification token deleted after use');
    
    // Get user data to potentially send welcome email
    const userResult = await db.query(
      'SELECT name, email FROM users WHERE id = $1',
      [tokenData.user_id]
    );
    
    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      console.log(`Retrieved user data for ${user.email}`);
      
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
    console.log(`Processing verification resend request for user ID: ${userId}`);
    
    // Get user email
    const userResult = await db.query(
      'SELECT email, verified FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      console.log(`User ID ${userId} not found`);
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    const user = userResult.rows[0];
    console.log(`User email: ${user.email}, verified status: ${user.verified}`);
    
    // Check if already verified
    if (user.verified) {
      console.log(`User ${userId} is already verified`);
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
    console.log(`Deleted existing verification tokens for user ${userId}`);
    
    // Generate new token
    const token = generateToken();
    console.log(`Generated new verification token`);
    
    // Set expiration (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    // Save token to database
    await db.query(
      'INSERT INTO verification_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [userId, token, expiresAt]
    );
    console.log(`Saved new verification token to database`);
    
    // Send verification email using Resend
    try {
      await sendVerificationEmail(user.email, token);
      console.log(`Successfully sent verification email to ${user.email}`);
    } catch (emailError) {
      console.error(`Failed to send verification email to ${user.email}:`, emailError);
      // Return error but don't expose sensitive details
      return res.status(500).json({ 
        message: 'Error al enviar el correo de verificación. Por favor, inténtalo más tarde.' 
      });
    }
    
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
    
    console.log(`Processing manual verification request for email: ${email}`);
    
    // Find user by email
    const userResult = await db.query(
      'SELECT id, verified FROM users WHERE email = $1',
      [email]
    );
    
    if (userResult.rows.length === 0) {
      console.log(`Email ${email} not found in users table`);
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    const user = userResult.rows[0];
    
    // Check if already verified
    if (user.verified) {
      console.log(`User with email ${email} is already verified`);
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
    console.log(`User ${user.id} manually verified`);
    
    res.json({ 
      message: 'Usuario verificado manualmente con éxito',
      verified: true
    });
  } catch (error) {
    console.error('Error manually verifying user:', error);
    res.status(500).json({ message: 'Error al verificar manualmente al usuario' });
  }
});

// New test endpoint to help diagnose email issues
router.get('/test-email', async (req, res) => {
  try {
    const testEmail = req.query.email || 'test@example.com';
    
    console.log(`Running email test to: ${testEmail}`);
    
    // Create test verification token
    const testToken = generateToken();
    
    // Send test email
    const result = await sendVerificationEmail(testEmail, testToken);
    
    res.json({
      success: true,
      message: `Test verification email sent successfully to ${testEmail}`,
      emailId: result.id,
      testToken: testToken
    });
  } catch (error) {
    console.error('Error sending test verification email:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to send test verification email',
      error: error.message
    });
  }
});

module.exports = router;