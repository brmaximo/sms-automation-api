// backend/config/mailer.js
const nodemailer = require('nodemailer');
require('dotenv').config();

// Configuración del transporte
const transporter = nodemailer.createTransport({
  service: 'gmail', // O el servicio que prefieras
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Función para enviar emails
const sendEmail = async (to, subject, html) => {
  try {
    const info = await transporter.sendMail({
      from: `"SMS Automation" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html
    });
    
    console.log('Email enviado: %s', info.messageId);
    return info;
  } catch (error) {
    console.error('Error al enviar email:', error);
    throw error;
  }
};

module.exports = { sendEmail };