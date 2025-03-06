const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('../db');
const nodemailer = require('nodemailer');

// Configure nodemailer with environment variables or defaults for testing
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.example.com',
  port: process.env.EMAIL_PORT || 587,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASSWORD || ''
  }
});

// Authentication middleware
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Acceso denegado. No se proporcionó token.' });
    }

    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Check if session exists in database
      const sessionResult = await db.query(
        'SELECT * FROM sessions WHERE user_id = $1 AND token = $2 AND expires_at > NOW()',
        [decoded.id, token]
      );

      if (sessionResult.rows.length === 0) {
        return res.status(401).json({ message: 'Sesión inválida o expirada' });
      }
      
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({ message: 'Token inválido o expirado' });
    }
  } catch (error) {
    console.error('Error en middleware de autenticación:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// Registration route
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    console.log('Register attempt for:', email);
    
    // Check if email exists
    const userExists = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: 'El correo electrónico ya está registrado' });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Insert user
    const newUser = await db.query(
      'INSERT INTO users (name, email, password, verified) VALUES ($1, $2, $3, FALSE) RETURNING id, name, email',
      [name, email, hashedPassword]
    );
    
    // Generate JWT
    const token = jwt.sign(
      { id: newUser.rows[0].id, email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    
    // Save session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    await db.query(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [newUser.rows[0].id, token, expiresAt]
    );
    
    // Skip email verification if no email config
    if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER) {
      console.log('Email configuration missing, skipping verification email');
      // Set user as verified for testing
      await db.query('UPDATE users SET verified = TRUE WHERE id = $1', [newUser.rows[0].id]);
      return res.status(201).json({
        message: 'Usuario registrado exitosamente',
        user: { ...newUser.rows[0], verified: true },
        token
      });
    }
    
    try {
      // Generate verification token
      const verificationToken = jwt.sign(
        { id: newUser.rows[0].id, email, type: 'email_verification' },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      // Save verification token
      await db.query(
        'INSERT INTO verification_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'24 hours\')',
        [newUser.rows[0].id, verificationToken]
      );
      
      // Send verification email
      const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${verificationToken}`;
      
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@example.com',
        to: email,
        subject: 'Verifica tu dirección de correo electrónico',
        html: `
          <h1>Verificación de correo electrónico</h1>
          <p>Hola ${name},</p>
          <p>Gracias por registrarte. Por favor, haz clic en el siguiente enlace para verificar tu dirección de correo electrónico:</p>
          <a href="${verificationUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4a69bd; color: white; text-decoration: none; border-radius: 5px;">Verificar correo</a>
          <p>Este enlace caducará en 24 horas.</p>
        `
      });
      console.log('Verification email sent to:', email);
    } catch (emailError) {
      console.error('Error sending verification email:', emailError);
      // Continue with registration even if email fails
    }
    
    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      user: { ...newUser.rows[0], verified: false },
      token
    });
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({ message: 'Error al registrar usuario' });
  }
});

// Login route
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user by email
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Credenciales inválidas' });
    }
    
    const user = result.rows[0];
    
    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Credenciales inválidas' });
    }
    
    // Generate token
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    
    // Delete old sessions
    await db.query('DELETE FROM sessions WHERE user_id = $1', [user.id]);
    
    // Save new session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    await db.query(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    );
    
    // Return without password
    const { password: _, ...userWithoutPassword } = user;
    
    res.json({
      message: 'Login exitoso',
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ message: 'Error al iniciar sesión' });
  }
});

// Get user info route
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await db.query('SELECT id, name, email, verified, created_at FROM users WHERE id = $1', [req.user.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ message: 'Error al obtener información del usuario' });
  }
});

// Logout route
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader.split(' ')[1];
    
    // Delete session
    await db.query('DELETE FROM sessions WHERE token = $1', [token]);
    
    res.json({ message: 'Sesión cerrada exitosamente' });
  } catch (error) {
    console.error('Error during logout:', error);
    res.status(500).json({ message: 'Error al cerrar sesión' });
  }
});

// Verify email route
router.get('/verify-email/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.type !== 'email_verification') {
      return res.status(400).json({ message: 'Token de verificación inválido' });
    }
    
    // Find token in database
    const tokenResult = await db.query(
      'SELECT * FROM verification_tokens WHERE token = $1 AND expires_at > NOW()',
      [token]
    );
    
    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ message: 'Token expirado o inválido' });
    }
    
    // Mark user as verified
    await db.query(
      'UPDATE users SET verified = TRUE WHERE id = $1',
      [decoded.id]
    );
    
    // Delete used token
    await db.query(
      'DELETE FROM verification_tokens WHERE token = $1',
      [token]
    );
    
    res.json({ message: 'Email verificado correctamente' });
  } catch (error) {
    console.error('Error verifying email:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(400).json({ message: 'Token inválido' });
    }
    res.status(500).json({ message: 'Error al verificar email' });
  }
});

// Resend verification email
router.post('/resend-verification', authMiddleware, async (req, res) => {
  try {
    // Check if already verified
    const userResult = await db.query(
      'SELECT verified, email, name FROM users WHERE id = $1',
      [req.user.id]
    );
    
    if (userResult.rows[0].verified) {
      return res.status(400).json({ message: 'Email ya verificado' });
    }
    
    // Delete old tokens
    await db.query(
      'DELETE FROM verification_tokens WHERE user_id = $1',
      [req.user.id]
    );
    
    if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER) {
      return res.status(500).json({ message: 'Configuración de email no disponible' });
    }
    
    // Create new token
    const verificationToken = jwt.sign(
      { id: req.user.id, email: req.user.email, type: 'email_verification' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // Save token
    await db.query(
      'INSERT INTO verification_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'24 hours\')',
      [req.user.id, verificationToken]
    );
    
    // Send email
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${verificationToken}`;
    
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@example.com',
      to: userResult.rows[0].email,
      subject: 'Verifica tu dirección de correo electrónico',
      html: `
        <h1>Verificación de correo electrónico</h1>
        <p>Hola ${userResult.rows[0].name},</p>
        <p>Por favor, haz clic en el siguiente enlace para verificar tu dirección de correo electrónico:</p>
        <a href="${verificationUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4a69bd; color: white; text-decoration: none; border-radius: 5px;">Verificar correo</a>
        <p>Este enlace caducará en 24 horas.</p>
      `
    });
    
    res.json({ message: 'Email de verificación reenviado' });
  } catch (error) {
    console.error('Error resending verification email:', error);
    res.status(500).json({ message: 'Error al reenviar email de verificación' });
  }
});

module.exports = router;