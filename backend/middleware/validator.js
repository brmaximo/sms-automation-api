// En /middleware/validator.js (nuevo archivo)
const { body, param, validationResult } = require('express-validator');

// Middleware para validar resultados
exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      errors: errors.array(),
      message: 'Error de validación en los datos ingresados'
    });
  }
  next();
};

// Validadores para campañas
exports.campaignValidators = [
  body('title').notEmpty().withMessage('El título es obligatorio').trim(),
  body('description').optional().trim(),
  body('incentive').optional().trim(),
  body('status').optional().isIn(['active', 'inactive']).withMessage('Estado inválido')
];

// Validadores para suscriptores
exports.subscriberValidators = [
  body('name').notEmpty().withMessage('El nombre es obligatorio').trim(),
  body('email').isEmail().withMessage('Email inválido').normalizeEmail(),
  body('phone').notEmpty().withMessage('El teléfono es obligatorio').trim(),
  body('source').optional().isIn(['qr', 'link']).withMessage('Origen inválido')
];