const express = require('express');
const cors = require('cors');
require('dotenv').config();
const authRoutes = require('./routes/auth');
const verificationRoutes = require('./routes/verification');
const db = require('./db');
const { sendEmail } = require('./emailService');

const app = express();
const PORT = process.env.PORT || 5000;

// SIMPLER CORS CONFIGURATION - Allow all origins for testing
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
app.use((req, res, next) => {
  res.removeHeader('X-Powered-By');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

// Basic route for API health check
app.get('/', (req, res) => {
  res.json({ 
    message: 'API SMS Automation funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

// Test route for verifying Resend email functionality
app.get('/api/test-email', async (req, res) => {
  try {
    const result = await sendEmail(
      'test@example.com',  // Replace with a test email
      'Test Email from SMS Automation',
      '<p>This is a test email from your Resend implementation!</p>'
    );
    res.json({
      success: true,
      message: 'Test email sent successfully',
      emailId: result.id
    });
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test email',
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
  
  // Now check database connection
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