// backend/routes/auth.js - Modificar la ruta de registro
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
    
    // Generar código de verificación (6 dígitos)
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Establecer expiración (15 minutos)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);
    
    // Insertar nuevo usuario
    const newUser = await db.query(
      'INSERT INTO users (name, email, password, verification_token, verification_token_expires) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email',
      [name, email, hashedPassword, verificationCode, expiresAt]
    );
    
    // Generar token JWT (este será temporal hasta verificación)
    const token = jwt.sign(
      { id: newUser.rows[0].id, email, verified: false },
      process.env.JWT_SECRET,
      { expiresIn: '1h' } // Token más corto hasta verificación
    );
    
    // Guardar la sesión
    await db.query(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [newUser.rows[0].id, token, new Date(Date.now() + 3600000)] // 1 hora
    );
    
    // Enviar email con código de verificación
    const { sendEmail } = require('../config/mailer');
    await sendEmail(
      email,
      'Verifica tu correo electrónico',
      `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4a69bd;">Verifica tu correo electrónico</h2>
        <p>Hola ${name},</p>
        <p>Gracias por registrarte en SMS Automation. Para completar tu registro, introduce el siguiente código en la página de verificación:</p>
        <div style="background-color: #f5f6fa; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
          ${verificationCode}
        </div>
        <p>Este código expirará en 15 minutos.</p>
        <p>Si no has solicitado este código, puedes ignorar este correo.</p>
        <p>Saludos,<br>El equipo de SMS Automation</p>
      </div>
      `
    );
    
    res.status(201).json({
      message: 'Usuario registrado exitosamente. Se ha enviado un código de verificación a tu correo electrónico.',
      user: newUser.rows[0],
      token,
      requiresVerification: true
    });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ message: 'Error al registrar usuario' });
  }
});

// backend/routes/auth.js - Añadir nueva ruta para verificar código
router.post('/verify-email', async (req, res) => {
  try {
    const { email, code } = req.body;
    
    // Buscar el usuario con este email y código
    const userResult = await db.query(
      'SELECT * FROM users WHERE email = $1 AND verification_token = $2 AND verification_token_expires > NOW()',
      [email, code]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(400).json({ 
        message: 'Código inválido o expirado. Por favor solicita un nuevo código.'
      });
    }
    
    const user = userResult.rows[0];
    
    // Actualizar usuario como verificado
    await db.query(
      'UPDATE users SET email_verified = true, verification_token = NULL, verification_token_expires = NULL WHERE id = $1',
      [user.id]
    );
    
    // Generar nuevo token JWT (completo)
    const token = jwt.sign(
      { id: user.id, email: user.email, verified: true },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );
    
    // Actualizar sesión
    await db.query('DELETE FROM sessions WHERE user_id = $1', [user.id]);
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 días de duración
    
    await db.query(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    );
    
    // Devolver respuesta
    const { password: _, verification_token: __, verification_token_expires: ___, ...userWithoutSensitiveInfo } = user;
    
    res.json({
      message: 'Email verificado exitosamente',
      user: userWithoutSensitiveInfo,
      token
    });
  } catch (error) {
    console.error('Error en verificación de email:', error);
    res.status(500).json({ message: 'Error al verificar email' });
  }
});

// backend/routes/auth.js - Añadir ruta para reenviar código
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    
    // Buscar el usuario
    const userResult = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    const user = userResult.rows[0];
    
    // Si ya está verificado
    if (user.email_verified) {
      return res.status(400).json({ message: 'Este email ya ha sido verificado' });
    }
    
    // Generar nuevo código
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Establecer nueva expiración (15 minutos)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);
    
    // Actualizar en base de datos
    await db.query(
      'UPDATE users SET verification_token = $1, verification_token_expires = $2 WHERE id = $3',
      [verificationCode, expiresAt, user.id]
    );
    
    // Enviar email con nuevo código
    const { sendEmail } = require('../config/mailer');
    await sendEmail(
      email,
      'Nuevo código de verificación',
      `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4a69bd;">Nuevo código de verificación</h2>
        <p>Hola ${user.name},</p>
        <p>Aquí tienes un nuevo código para verificar tu correo electrónico:</p>
        <div style="background-color: #f5f6fa; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
          ${verificationCode}
        </div>
        <p>Este código expirará en 15 minutos.</p>
        <p>Si no has solicitado este código, puedes ignorar este correo.</p>
        <p>Saludos,<br>El equipo de SMS Automation</p>
      </div>
      `
    );
    
    res.json({
      message: 'Código de verificación reenviado exitosamente'
    });
  } catch (error) {
    console.error('Error al reenviar código:', error);
    res.status(500).json({ message: 'Error al reenviar código de verificación' });
  }
});
// backend/middleware/auth.js
module.exports = async (req, res, next) => {
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
      
      // Verificar si el email está verificado
      const userResult = await db.query(
        'SELECT email_verified FROM users WHERE id = $1',
        [decoded.id]
      );
      
      if (userResult.rows.length === 0) {
        return res.status(401).json({ message: 'Usuario no encontrado' });
      }
      
      if (!userResult.rows[0].email_verified) {
        return res.status(403).json({ 
          message: 'Email no verificado',
          requiresVerification: true
        });
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