// En /middleware/rateLimit.js
const rateLimit = require('express-rate-limit');

// Limitar intentos de inicio de sesión
exports.loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 intentos
  message: {
    success: false,
    message: 'Demasiados intentos de inicio de sesión. Por favor, inténtalo más tarde.'
  }
});

// Limitar creación de cuentas
exports.registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // 3 intentos
  message: {
    success: false,
    message: 'Demasiados intentos de registro. Por favor, inténtalo más tarde.'
  }
});

// Limitar acceso a API pública
exports.publicApiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 100, // 100 peticiones
  message: {
    success: false,
    message: 'Límite de peticiones excedido. Por favor, inténtalo más tarde.'
  }
});