const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('../db');
const nodemailer = require('nodemailer');

// Configure email transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Middleware de autenticación - será aplicado solo a rutas protegidas
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Acceso denegado. No se proporcionó token.' });
    }

    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Verificar si la sesión existe en la base de datos
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

// Ruta de registro (pública - sin autenticación)
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Verificar si el correo ya existe
    const userExists = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: 'El correo electrónico ya está registrado' });
    }
    
    // Hash de la contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Insertar nuevo usuario
    const newUser = await db.query(
      'INSERT INTO users (name, email, password, verified) VALUES ($1, $2, $3, FALSE) RETURNING id, name, email',
      [name, email, hashedPassword]
    );
    
    // Generar token JWT
    const token = jwt.sign(
      { id: newUser.rows[0].id, email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );
    
    // Guardar la sesión
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 días de duración
    
    await db.query(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [newUser.rows[0].id, token, expiresAt]
    );
    
    // Generar verification token
    const verificationToken = jwt.sign(
      { id: newUser.rows[0].id, email, type: 'email_verification' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // Guardar token de verificación
    await db.query(
      'INSERT INTO verification_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'24 hours\')',
      [newUser.rows[0].id, verificationToken]
    );
    
    // Enviar email de verificación
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
    
    try {
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
          <p>Si no solicitaste este registro, puedes ignorar este correo.</p>
        `
      });
    } catch (emailError) {
      console.error('Error al enviar correo de verificación:', emailError);
      // Continuamos con el registro aunque falle el envío del correo
    }
    
    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      user: { ...newUser.rows[0], verified: false },
      token
    });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ message: 'Error al registrar usuario' });
  }
});

// Ruta de login (pública - sin autenticación)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Buscar usuario por email
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Credenciales inválidas' });
    }
    
    const user = result.rows[0];
    
    // Verificar contraseña
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Credenciales inválidas' });
    }
    
    // Generar token JWT
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );
    
    // Eliminar sesiones antiguas del usuario
    await db.query('DELETE FROM sessions WHERE user_id = $1', [user.id]);
    
    // Guardar la nueva sesión
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 días de duración
    
    await db.query(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    );
    
    // Devolver respuesta sin la contraseña
    const { password: _, ...userWithoutPassword } = user;
    
    res.json({
      message: 'Login exitoso',
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ message: 'Error al iniciar sesión' });
  }
});

// Ruta para obtener información del usuario (protegida - requiere autenticación)
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await db.query('SELECT id, name, email, verified, created_at FROM users WHERE id = $1', [req.user.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({ message: 'Error al obtener información del usuario' });
  }
});

// Ruta para cerrar sesión (protegida - requiere autenticación)
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader.split(' ')[1];
    
    // Eliminar la sesión de la base de datos
    await db.query('DELETE FROM sessions WHERE token = $1', [token]);
    
    res.json({ message: 'Sesión cerrada exitosamente' });
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
    res.status(500).json({ message: 'Error al cerrar sesión' });
  }
});

module.exports = router;