const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');
const nodemailer = require('nodemailer');

const router = express.Router();

// Configuración del transporter de email
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Registro de usuario
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Verificar si el correo ya existe
    const userExists = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: 'El correo electrónico ya está en uso' });
    }

    // Encriptar contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // Generar token de verificación
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Insertar usuario en la base de datos
    const result = await db.query(
      'INSERT INTO users (name, email, password, email_verified, verification_token) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email',
      [name, email, hashedPassword, false, verificationToken]
    );

    const user = result.rows[0];

    // Enviar email de verificación
    const verificationLink = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Verifica tu email - SMS Automation',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #4a69bd;">Bienvenido a SMS Automation</h1>
          <p>Gracias por registrarte. Para completar tu registro y acceder a todas las funciones, por favor verifica tu dirección de correo electrónico:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationLink}" style="background-color: #4a69bd; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
              Verificar mi email
            </a>
          </div>
          
          <p>Si el botón no funciona, puedes copiar y pegar este enlace en tu navegador:</p>
          <p style="word-break: break-all; color: #666;">${verificationLink}</p>
          
          <p>Este enlace expirará en 24 horas.</p>
          
          <hr style="border: 1px solid #eee; margin: 30px 0;" />
          
          <p style="color: #888; font-size: 14px;">
            Si no creaste una cuenta en SMS Automation, puedes ignorar este mensaje.
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    res.status(201).json({
      message: 'Usuario registrado exitosamente. Por favor verifica tu email.',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: false
      }
    });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ message: 'Error al registrar usuario' });
  }
});

// Verificar email
router.get('/verify-email/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    // Buscar usuario con este token
    const result = await db.query('SELECT * FROM users WHERE verification_token = $1', [token]);
    
    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Token de verificación inválido' });
    }
    
    const user = result.rows[0];
    
    // Actualizar usuario como verificado
    await db.query(
      'UPDATE users SET email_verified = true, verification_token = null, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );
    
    res.json({ message: 'Email verificado exitosamente. Ahora puedes iniciar sesión.' });
  } catch (error) {
    console.error('Error en verificación de email:', error);
    res.status(500).json({ message: 'Error al verificar email' });
  }
});

// Login de usuario
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Buscar usuario por email
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const user = result.rows[0];

    // Verificar contraseña
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }
    
    // Verificar si el email está verificado
    if (!user.email_verified) {
      return res.status(403).json({ 
        message: 'Por favor verifica tu email antes de iniciar sesión',
        needsVerification: true,
        email: user.email
      });
    }

    // Generar token JWT
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    // Guardar sesión en la base de datos
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);  // 7 días para la expiración

    await db.query(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    );

    res.json({
      message: 'Login exitoso',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.email_verified
      },
      token
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ message: 'Error al iniciar sesión' });
  }
});

// Verificar token y obtener datos del usuario
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Token no proporcionado' });
    }

    const token = authHeader.split(' ')[1];

    // Verificar el token
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

      // Obtener datos del usuario
      const userResult = await db.query(
        'SELECT id, name, email, email_verified FROM users WHERE id = $1',
        [decoded.id]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      const user = userResult.rows[0];

      res.json({ 
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          emailVerified: user.email_verified
        } 
      });
    } catch (error) {
      return res.status(401).json({ message: 'Token inválido' });
    }
  } catch (error) {
    console.error('Error al verificar usuario:', error);
    res.status(500).json({ message: 'Error al verificar usuario' });
  }
});

// Reenviar email de verificación
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    
    // Buscar usuario por email
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    const user = result.rows[0];
    
    if (user.email_verified) {
      return res.status(400).json({ message: 'Este email ya está verificado' });
    }
    
    // Generar nuevo token de verificación
    const verificationToken = crypto.randomBytes(32).toString('hex');
    
    // Actualizar token de verificación
    await db.query(
      'UPDATE users SET verification_token = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [verificationToken, user.id]
    );
    
    // Enviar email de verificación
    const verificationLink = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Verifica tu email - SMS Automation',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #4a69bd;">Verificación de email</h1>
          <p>Por favor, verifica tu email haciendo clic en el siguiente enlace:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationLink}" style="background-color: #4a69bd; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
              Verificar mi email
            </a>
          </div>
          
          <p>Si el botón no funciona, puedes copiar y pegar este enlace en tu navegador:</p>
          <p style="word-break: break-all; color: #666;">${verificationLink}</p>
          
          <p>Este enlace expirará en 24 horas.</p>
          
          <hr style="border: 1px solid #eee; margin: 30px 0;" />
          
          <p style="color: #888; font-size: 14px;">
            Si no solicitaste este email, puedes ignorar este mensaje.
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    
    res.json({ message: 'Email de verificación reenviado exitosamente' });
  } catch (error) {
    console.error('Error al reenviar email de verificación:', error);
    res.status(500).json({ message: 'Error al reenviar email de verificación' });
  }
});

// Cerrar sesión
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Token no proporcionado' });
    }

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