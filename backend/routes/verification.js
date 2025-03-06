const nodemailer = require('nodemailer');

// Dentro del endpoint /resend, después de crear el token:
// Configurar transporte de nodemailer
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// URL del frontend para la verificación
const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${token}`;

// Enviar el email
const info = await transporter.sendMail({
  from: `"SMS Automation" <${process.env.EMAIL_FROM}>`,
  to: req.user.email,
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