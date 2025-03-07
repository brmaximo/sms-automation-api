// backend/emailTemplates.js

/**
 * Generates an HTML email template for email verification
 * @param {string} verificationUrl - The URL for email verification
 * @returns {string} - HTML template as a string
 */
function getVerificationEmailTemplate(verificationUrl) {
    return `<!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Verify Your Email</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        line-height: 1.6;
        color: #333;
        margin: 0;
        padding: 0;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
      }
      .header {
        background-color: #4a69bd;
        color: white;
        padding: 20px;
        text-align: center;
        border-radius: 5px 5px 0 0;
      }
      .content {
        background-color: #f9f9f9;
        padding: 30px;
        border-radius: 0 0 5px 5px;
        border: 1px solid #e0e0e0;
      }
      .button {
        display: inline-block;
        background-color: #4a69bd;
        color: white;
        padding: 12px 25px;
        text-decoration: none;
        border-radius: 5px;
        margin: 20px 0;
        font-weight: bold;
      }
      .footer {
        text-align: center;
        margin-top: 20px;
        font-size: 12px;
        color: #777;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>SMS Automation</h1>
      </div>
      <div class="content">
        <h2>Verifica tu dirección de correo electrónico</h2>
        <p>Gracias por registrarte. Para completar tu registro y acceder a todas las funciones, verifica tu dirección de correo electrónico haciendo clic en el botón a continuación:</p>
        
        <div style="text-align: center;">
          <a href="${verificationUrl}" class="button">Verificar mi correo electrónico</a>
        </div>
        
        <p>Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:</p>
        <p style="word-break: break-all;">${verificationUrl}</p>
        
        <p>Este enlace expirará en 24 horas.</p>
      </div>
      <div class="footer">
        <p>&copy; 2025 SMS Automation. Todos los derechos reservados.</p>
      </div>
    </div>
  </body>
  </html>`;
  }
  
  /**
   * Generates an HTML email template for password reset
   * @param {string} resetUrl - The URL for password reset
   * @returns {string} - HTML template as a string
   */
  function getPasswordResetTemplate(resetUrl) {
    return `<!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Restablecer Contraseña</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        line-height: 1.6;
        color: #333;
        margin: 0;
        padding: 0;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
      }
      .header {
        background-color: #4a69bd;
        color: white;
        padding: 20px;
        text-align: center;
        border-radius: 5px 5px 0 0;
      }
      .content {
        background-color: #f9f9f9;
        padding: 30px;
        border-radius: 0 0 5px 5px;
        border: 1px solid #e0e0e0;
      }
      .button {
        display: inline-block;
        background-color: #4a69bd;
        color: white;
        padding: 12px 25px;
        text-decoration: none;
        border-radius: 5px;
        margin: 20px 0;
        font-weight: bold;
      }
      .footer {
        text-align: center;
        margin-top: 20px;
        font-size: 12px;
        color: #777;
      }
      .warning {
        background-color: #fff3cd;
        border-left: 4px solid #ffc107;
        padding: 15px;
        margin: 20px 0;
        color: #856404;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>SMS Automation</h1>
      </div>
      <div class="content">
        <h2>Solicitud de restablecimiento de contraseña</h2>
        <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta. Haz clic en el botón a continuación para crear una nueva contraseña:</p>
        
        <div style="text-align: center;">
          <a href="${resetUrl}" class="button">Restablecer contraseña</a>
        </div>
        
        <p>Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:</p>
        <p style="word-break: break-all;">${resetUrl}</p>
        
        <div class="warning">
          <p><strong>Aviso importante:</strong> Si no solicitaste restablecer tu contraseña, por favor ignora este mensaje o contacta con nuestro equipo de soporte.</p>
        </div>
        
        <p>Este enlace expirará en 1 hora por razones de seguridad.</p>
      </div>
      <div class="footer">
        <p>&copy; 2025 SMS Automation. Todos los derechos reservados.</p>
      </div>
    </div>
  </body>
  </html>`;
  }
  
  /**
   * Generates an HTML email template for welcome emails
   * @param {string} name - User's name
   * @param {string} loginUrl - The URL to login to the app
   * @returns {string} - HTML template as a string
   */
  function getWelcomeEmailTemplate(name, loginUrl) {
    return `<!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Bienvenido a SMS Automation</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        line-height: 1.6;
        color: #333;
        margin: 0;
        padding: 0;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
      }
      .header {
        background-color: #4a69bd;
        color: white;
        padding: 20px;
        text-align: center;
        border-radius: 5px 5px 0 0;
      }
      .content {
        background-color: #f9f9f9;
        padding: 30px;
        border-radius: 0 0 5px 5px;
        border: 1px solid #e0e0e0;
      }
      .button {
        display: inline-block;
        background-color: #4a69bd;
        color: white;
        padding: 12px 25px;
        text-decoration: none;
        border-radius: 5px;
        margin: 20px 0;
        font-weight: bold;
      }
      .footer {
        text-align: center;
        margin-top: 20px;
        font-size: 12px;
        color: #777;
      }
      .feature {
        margin: 20px 0;
        padding-left: 20px;
        border-left: 3px solid #4a69bd;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>SMS Automation</h1>
      </div>
      <div class="content">
        <h2>¡Bienvenido/a, ${name}!</h2>
        <p>Gracias por unirte a SMS Automation. Estamos emocionados de tenerte como parte de nuestra comunidad.</p>
        
        <p>Con SMS Automation, podrás:</p>
        
        <div class="feature">
          <p><strong>Crear campañas SMS</strong> - Llega a tu audiencia de manera efectiva con mensajes directos</p>
        </div>
        
        <div class="feature">
          <p><strong>Generar códigos QR personalizados</strong> - Facilita a tus clientes la suscripción a tus campañas</p>
        </div>
        
        <div class="feature">
          <p><strong>Analizar resultados</strong> - Mide el impacto de tus campañas con análisis detallados</p>
        </div>
        
        <p>¿Listo para comenzar? Inicia sesión en tu cuenta para explorar todas las funcionalidades:</p>
        
        <div style="text-align: center;">
          <a href="${loginUrl}" class="button">Ir a mi cuenta</a>
        </div>
        
        <p>Si necesitas ayuda o tienes alguna pregunta, no dudes en contactar a nuestro equipo de soporte.</p>
      </div>
      <div class="footer">
        <p>&copy; 2025 SMS Automation. Todos los derechos reservados.</p>
      </div>
    </div>
  </body>
  </html>`;
  }
  
  module.exports = {
    getVerificationEmailTemplate,
    getPasswordResetTemplate,
    getWelcomeEmailTemplate
  };