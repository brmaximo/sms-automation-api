const { Resend } = require('resend');

// Inicializar con tu API key
const resend = new Resend('re_MrNnhf8X_N9ksv3PX1aGmyBT4fEMJX1V6');

// Crear el contenido HTML del email
const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Test Email from SMS Automation</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #4a69bd; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
    <h1 style="margin: 0;">SMS Automation</h1>
    <p style="margin-top: 10px;">Test de Servicio de Email</p>
  </div>
  
  <div style="background-color: #f9f9f9; padding: 20px; border: 1px solid #e0e0e0; border-radius: 0 0 5px 5px;">
    <h2>¡El servicio de email está funcionando correctamente!</h2>
    
    <div style="padding: 10px 15px; margin: 10px 0; border-radius: 4px; background-color: #d4edda; border-left: 4px solid #28a745; color: #155724;">
      <strong>Estado:</strong> Conectado al servicio Resend API
    </div>
    
    <p>Este correo confirma que el sistema de envío de emails de <strong>SMS Automation</strong> está correctamente configurado y funcionando.</p>
    
    <h3>Información de la prueba:</h3>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;"><strong>Fecha y hora:</strong></td>
        <td style="border: 1px solid #ddd; padding: 8px;">${new Date().toLocaleString('es-ES')}</td>
      </tr>
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;"><strong>Servicio:</strong></td>
        <td style="border: 1px solid #ddd; padding: 8px;">Resend API</td>
      </tr>
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;"><strong>API Key:</strong></td>
        <td style="border: 1px solid #ddd; padding: 8px;">Configurada correctamente</td>
      </tr>
    </table>
    
    <div style="padding: 10px 15px; margin: 10px 0; border-radius: 4px; background-color: #fff3cd; border-left: 4px solid #ffc107; color: #856404;">
      <p><strong>Nota:</strong> Este es un email de prueba automático. Por favor, no responda a este mensaje.</p>
    </div>
    
    <div style="text-align: center; margin-top: 30px;">
      <a href="#" style="display: inline-block; background-color: #4a69bd; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Ir al Panel de Administración</a>
    </div>
  </div>
  
  <div style="text-align: center; margin-top: 20px; padding: 20px; font-size: 12px; color: #777; border-top: 1px solid #e0e0e0;">
    <p>&copy; 2025 SMS Automation. Todos los derechos reservados.</p>
    <p>Este email fue enviado como parte de una prueba técnica del sistema.</p>
  </div>
</body>
</html>`;

// Función para enviar el email
async function sendTestEmail() {
  try {
    const data = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: 'maximobriso00@gmail.com', // El correo al que quieres enviar la prueba
      subject: 'Test Email - SMS Automation',
      html: htmlContent
    });
    
    console.log('¡Éxito! Email enviado con ID:', data.id);
    return data;
  } catch (error) {
    console.error('Error al enviar email:', error);
    throw error;
  }
}

// Ejecutar la función
sendTestEmail();