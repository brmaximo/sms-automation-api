const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

// Function to send verification email
async function sendVerificationEmail(email, token) {
  // Create a nodemailer transporter
  const nodemailer = require('nodemailer');
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

// Registration endpoint - NO auth middleware
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    
    // Check if email exists
    const emailCheck = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ message: 'Email already exists' });
    }
    
    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Insert new user
    const result = await db.query(
      'INSERT INTO users (name, email, password, verified) VALUES ($1, $2, $3, $4) RETURNING id, name, email',
      [name, email, hashedPassword, false]
    );
    
    const user = result.rows[0];
    
    // Create token for auto login (optional)
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );
    
    // Store session in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now
    
    await db.query(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    );
    
    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    
    // Set expiration (24 hours from now)
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setHours(tokenExpiresAt.getHours() + 24);
    
    // Save verification token to database
    await db.query(
      'INSERT INTO verification_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, verificationToken, tokenExpiresAt]
    );
    
    // Send verification email
    try {
      await sendVerificationEmail(email, verificationToken);
    } catch (emailError) {
      console.error('Error sending verification email:', emailError);
      // Continue with registration even if email fails
    }
    
    res.status(201).json({
      message: 'User registered successfully. Please check your email to verify your account.',
      user,
      token,
      verified: false
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ message: 'Error registering user' });
  }
});

// Login endpoint - NO auth middleware
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    
    // Compare password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Create token
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );
    
    // Store session in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now
    
    await db.query(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    );
    
    // Return user info (without password) and token
    const { password: _, ...userWithoutPassword } = user;
    
    res.json({
      user: userWithoutPassword,
      token,
      verified: user.verified
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ message: 'Error logging in' });
  }
});

// Protected routes BELOW this line
// Use middleware for protected routes
router.use(authMiddleware);

// Get current user info - WITH auth middleware
router.get('/me', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, email, verified, created_at FROM users WHERE id = $1', 
      [req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ message: 'Error fetching user data' });
  }
});

// Logout - WITH auth middleware
router.post('/logout', async (req, res) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    
    await db.query('DELETE FROM sessions WHERE token = $1', [token]);
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error logging out:', error);
    res.status(500).json({ message: 'Error logging out' });
  }
});

// Request new verification email - WITH auth middleware
router.post('/resend-verification', async (req, res) => {
  try {
    // Get user info
    const userResult = await db.query(
      'SELECT email, verified FROM users WHERE id = $1',
      [req.user.id]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
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
      [req.user.id]
    );
    
    // Generate new token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    
    // Set expiration (24 hours from now)
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setHours(tokenExpiresAt.getHours() + 24);
    
    // Save token to database
    await db.query(
      'INSERT INTO verification_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [req.user.id, verificationToken, tokenExpiresAt]
    );
    
    // Send verification email
    await sendVerificationEmail(user.email, verificationToken);
    
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

// Verify email with token - NO auth middleware
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
    
    // Return success message
    res.json({ 
      message: 'Email verificado correctamente',
      verified: true
    });
  } catch (error) {
    console.error('Error verifying email:', error);
    res.status(500).json({ message: 'Error al verificar el email' });
  }
});

module.exports = router;