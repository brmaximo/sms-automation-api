const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const authRoutes = require('./routes/auth');
require('dotenv').config();

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

// Configurar Helmet de forma segura para versiones antiguas de Node.js
try {
  // Usar configuraciones individuales de Helmet para evitar características avanzadas
  app.use(helmet.hidePoweredBy());
  app.use(helmet.frameguard({ action: 'sameorigin' }));
  app.use(helmet.noSniff());
  app.use(helmet.xssFilter());
  app.use(helmet.ieNoOpen());
  app.use(helmet.dnsPrefetchControl());
  
  // Intentar aplicar HSTS si es posible
  try {
    app.use(helmet.hsts({
      maxAge: 15552000,
      includeSubDomains: true
    }));
  } catch (e) {
    console.warn('No se pudo configurar HSTS:', e.message);
  }
} catch (error) {
  console.warn('Helmet no pudo inicializarse correctamente:', error.message);
  // Continuar sin helmet si hay problemas
}

// Agregar encabezados CORS manualmente para mayor seguridad
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  next();
});

// Ruta básica para verificar que el servidor está funcionando
app.get('/', (req, res) => {
  res.json({ message: 'API SMS Automation funcionando correctamente' });
});

// Rutas
app.use('/api/auth', authRoutes);

// Manejo de errores
app.use((err, req, res, next) => {
  console.error('Error en servidor:', err.stack);
  res.status(500).json({ message: 'Error interno del servidor' });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en el puerto ${PORT} (${new Date().toISOString()})`);
});

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
  console.error('Error no capturado:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Promesa rechazada no manejada:', reason);
});