const express = require('express');
const cors = require('cors');
require('dotenv').config();
const authRoutes = require('./routes/auth');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

// Improved CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow any origin in development or specific origins in production
    const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*';
    
    if (allowedOrigins === '*' || !origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Length', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400
};

// IMPORTANT: Apply CORS before any other middleware
app.use(cors(corsOptions));

// Middleware for OPTIONS preflight
app.options('*', cors(corsOptions));

// Basic express middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Security headers implementation without Helmet (to avoid compatibility issues)
// Note: The error in your logs was related to helmet using the nullish coalescing operator (??)
// which isn't supported in older Node.js versions
app.use((req, res, next) => {
  // Remove the X-Powered-By header
  res.removeHeader('X-Powered-By');
  
  // Set security headers manually
  res.setHeader('X-XSS-Protection', '0'); // Modern browsers have built-in protections
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade');
  
  // Only apply HSTS in production environments
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
  
  next();
});

// Basic route for API health check
app.get('/', (req, res) => {
  res.json({ 
    message: 'API SMS Automation funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

// Mount authentication routes
app.use('/api/auth', authRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error en servidor:', err);
  
  // Provide appropriate error response
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Error interno del servidor';
  
  res.status(statusCode).json({
    error: {
      message,
      status: statusCode,
      // Don't include stack trace in production
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    }
  });
});

// Handle 404 - Route not found
app.use((req, res) => {
  res.status(404).json({
    error: {
      message: 'Ruta no encontrada',
      status: 404,
      path: req.originalUrl
    }
  });
});

// Verify database connection before starting server
async function startServer() {
  try {
    // Test database connection
    const result = await db.query('SELECT NOW()');
    console.log('Conexión a base de datos PostgreSQL establecida correctamente:', result.rows[0].now);
    
    // Start server
    app.listen(PORT, () => {
      console.log(`Servidor ejecutándose en el puerto ${PORT} (${new Date().toISOString()})`);
      console.log(`Modo: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Error al conectar con la base de datos:', error);
    console.error('Cerrando aplicación debido a error de conexión a la base de datos');
    process.exit(1);
  }
}

// Start the server
startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM recibido, cerrando servidor...');
  process.exit(0);
});

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (error) => {
  console.error('Error no capturado:', error);
  // In production, you might want to gracefully shut down to avoid inconsistent state
  if (process.env.NODE_ENV === 'production') {
    console.error('Cerrando servidor debido a excepción no capturada');
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Promesa rechazada no manejada:', reason);
  // Log but don't exit in unhandled rejections (they're less critical)
});