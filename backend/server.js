const express = require('express');
const cors = require('cors');
require('dotenv').config();
const authRoutes = require('./routes/auth');
const verificationRoutes = require('./routes/verification'); // Nueva línea para importar rutas de verificación
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

// Configuración mejorada de CORS
const corsOptions = {
  origin: function (origin, callback) {
    // Permitir cualquier origen
    callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Length', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400
};

// IMPORTANTE: Aplicar CORS antes que cualquier otro middleware
app.use(cors(corsOptions));

// Middleware para OPTIONS preflight
app.options('*', cors(corsOptions));

// Middleware para express
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Implementar manualmente los encabezados de seguridad básicos en lugar de usar Helmet
app.use((req, res, next) => {
  // Ocultar el encabezado X-Powered-By
  res.removeHeader('X-Powered-By');
  
  // Configurar encabezados de seguridad básicos
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  
  // Intentar configurar HSTS
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
  
  next();
});

// Ruta básica para verificar que el servidor está funcionando
app.get('/', (req, res) => {
  res.json({ message: 'API SMS Automation funcionando correctamente' });
});

// Rutas de autenticación
app.use('/api/auth', authRoutes);

// Rutas de verificación de email (nueva línea)
app.use('/api/verification', verificationRoutes);

// Manejo de errores
app.use((err, req, res, next) => {
  console.error('Error en servidor:', err.stack);
  res.status(500).json({ message: 'Error interno del servidor' });
});

// Verificar conexión a la base de datos antes de iniciar el servidor
db.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Error al conectar con la base de datos:', err);
    process.exit(1);
  } else {
    console.log('Conexión a base de datos PostgreSQL establecida correctamente');
    
    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(`Servidor ejecutándose en el puerto ${PORT} (${new Date().toISOString()})`);
    });
  }
});

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
  console.error('Error no capturado:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Promesa rechazada no manejada:', reason);
});