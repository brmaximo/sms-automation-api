const express = require('express');
const cors = require('cors');
require('dotenv').config();
const authRoutes = require('./routes/auth');
const verificationRoutes = require('./routes/verification');
const db = require('./db');
const { sendEmail } = require('./emailService');

const app = express();
const PORT = process.env.PORT || 5000;

// CORS Configuration - Allow all origins for testing
app.use(cors({
  origin: '*',  // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Add a CORS preflight handler for all routes
app.options('*', cors());

// Basic express middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Security headers implementation without Helmet
// Avoids the syntax error with the nullish coalescing operator (??)
app.use((req, res, next) => {
  res.removeHeader('X-Powered-By');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

// Basic route for API health check
app.get('/', (req, res) => {
  res.json({ 
    message: 'API SMS Automation funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

// Comprehensive test route for verifying Resend email functionality
app.get('/api/test-email', async (req, res) => {
  try {
    // Get the destination email from query parameter or use a default
    const testEmail = req.query.email || 'your-test-email@example.com';
    
    // Replace placeholder with current date
    const currentDate = new Date().toLocaleString('es-ES', { 
      timeZone: 'Europe/Madrid' 
    });
    
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Test Email from SMS Automation</title>
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
      <h1>SMS Automation Test</h1>
    </div>
    <div class="content">
      <h2>Email Delivery Test</h2>
      <p>Este es un email de prueba para verificar que el servicio de Resend está funcionando correctamente.</p>
      
      <p>Detalles:</p>
      <ul>
        <li>Fecha y hora: ${currentDate}</li>
        <li>Servicio: Resend API</li>
        <li>Aplicación: SMS Automation</li>
        <li>API Key: ${process.env.RESEND_API_KEY ? '✓ Configurada' : '✗ No configurada'}</li>
      </ul>
      
      <p>Si has recibido este email, significa que la configuración de Resend está funcionando correctamente.</p>
      
      <div style="text-align: center;">
        <a href="https://app.resend.com/api-keys" class="button">Ir a Resend Dashboard</a>
      </div>
    </div>
    <div class="footer">
      <p>&copy; 2025 SMS Automation. Todos los derechos reservados.</p>
    </div>
  </div>
</body>
</html>`;

    // Log email attempt (with partially masked API key for security)
    console.log(`Attempting to send test email to: ${testEmail}`);
    if (process.env.RESEND_API_KEY) {
      const maskedKey = `${process.env.RESEND_API_KEY.substring(0, 8)}...${process.env.RESEND_API_KEY.substring(process.env.RESEND_API_KEY.length - 4)}`;
      console.log(`Using Resend API Key: ${maskedKey}`);
    } else {
      console.error('RESEND_API_KEY is not defined in environment variables');
    }
    
    // Send the test email using the emailService
    const result = await sendEmail(
      testEmail,
      'Test Email - SMS Automation',
      htmlContent
    );
    
    console.log(`Email sent successfully with ID: ${result?.id || 'unknown'}`);
    
    res.json({
      success: true,
      message: `Test email sent successfully to ${testEmail}`,
      emailId: result?.id,
      apiKeyConfigured: !!process.env.RESEND_API_KEY,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error sending test email:', error);
    
    // Determine if error is related to the Resend API configuration
    let errorType = 'unknown';
    if (error.message && error.message.includes('API key')) {
      errorType = 'api_key';
    } else if (error.message && error.message.includes('network')) {
      errorType = 'network';
    } else if (!process.env.RESEND_API_KEY) {
      errorType = 'missing_api_key';
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to send test email',
      error: error.message,
      errorType: errorType,
      apiKeyPresent: !!process.env.RESEND_API_KEY,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Simple test route for basic Resend functionality
app.get('/api/simple-test-email', async (req, res) => {
  try {
    // Get the destination email from query parameter or use a default
    const testEmail = req.query.email || 'your-test-email@example.com';
    
    const result = await sendEmail(
      testEmail,
      'Simple Test Email from SMS Automation',
      '<h1>Test Email</h1><p>This is a simple test email to verify Resend is working correctly.</p>'
    );
    
    res.json({
      success: true,
      message: `Simple test email sent successfully to ${testEmail}`,
      emailId: result?.id
    });
  } catch (error) {
    console.error('Error sending simple test email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send simple test email',
      error: error.message
    });
  }
});

// Mount authentication routes
app.use('/api/auth', authRoutes);

// Mount verification routes
app.use('/api/verification', verificationRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error en servidor:', err);
  res.status(500).json({
    error: {
      message: 'Error interno del servidor',
      details: process.env.NODE_ENV !== 'production' ? err.message : undefined
    }
  });
});

// Handle 404 - Route not found
app.use((req, res) => {
  res.status(404).json({
    error: {
      message: 'Ruta no encontrada',
      path: req.originalUrl
    }
  });
});

// Start server first, then check database connection
const server = app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en el puerto ${PORT} (${new Date().toISOString()})`);
  
  // Check and log environment variables (masked for security)
  console.log('Environment variables check:');
  console.log(`- NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
  console.log(`- PORT: ${process.env.PORT || '5000 (default)'}`);
  console.log(`- DB_HOST: ${process.env.DB_HOST || 'not set'}`);
  console.log(`- RESEND_API_KEY: ${process.env.RESEND_API_KEY ? 'Configured' : 'NOT CONFIGURED'}`);
  console.log(`- RESEND_FROM: ${process.env.RESEND_FROM || 'not set'}`);
  
  // Check database connection
  db.query('SELECT NOW()')
    .then(result => {
      console.log('Conexión a base de datos PostgreSQL establecida correctamente:', result.rows[0].now);
    })
    .catch(error => {
      console.error('Advertencia: Error al conectar con la base de datos:', error);
      console.error('El servidor continúa funcionando pero algunas funciones pueden no estar disponibles');
    });
  
  // Log email configuration
  console.log('Email service configured with Resend');
});

// Error handling for server startup
server.on('error', (error) => {
  console.error('Error al iniciar el servidor:', error);
  process.exit(1);
});

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (error) => {
  console.error('Error no capturado:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('Promesa rechazada no manejada:', reason);
});

module.exports = app; // Export for testing purposes