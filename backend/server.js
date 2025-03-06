const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const authRoutes = require('./routes/auth');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Configuración detallada de CORS
const corsOptions = {
  origin: ['http://localhost:5173', 'https://yo-towingllc.com', 'http://yo-towingllc.com'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400 // 24 horas (en segundos)
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(helmet({
  contentSecurityPolicy: false // Desactivamos CSP por ahora para evitar problemas
}));

// Ruta básica para verificar que el servidor está funcionando
app.get('/', (req, res) => {
  res.json({ message: 'API SMS Automation funcionando correctamente' });
});

// Rutas
app.use('/api/auth', authRoutes);

// Middleware específico para las opciones CORS preflight
app.options('*', cors(corsOptions));

// Manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Error interno del servidor' });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en el puerto ${PORT}`);
});