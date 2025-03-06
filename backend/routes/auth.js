const jwt = require('jsonwebtoken');
const db = require('../db');

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Acceso denegado. No se proporcionó token.' });
    }

    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Verificar si la sesión existe en la base de datos
      const sessionResult = await db.query(
        'SELECT * FROM sessions WHERE user_id = $1 AND token = $2 AND expires_at > NOW()',
        [decoded.id, token]
      );

      if (sessionResult.rows.length === 0) {
        return res.status(401).json({ message: 'Sesión inválida o expirada' });
      }
      
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({ message: 'Token inválido o expirado' });
    }
  } catch (error) {
    console.error('Error en middleware de autenticación:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};
