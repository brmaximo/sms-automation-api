const jwt = require('jsonwebtoken');
const db = require('../db');

module.exports = async (req, res, next) => {
  try {
    // Check if Authorization header exists
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Acceso denegado. No se proporcionó token.' });
    }

    // Extract the token from the Authorization header
    const token = authHeader.split(' ')[1];
    
    try {
      // Verify the token with the secret key
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Check if the session exists in the database and hasn't expired
      const sessionResult = await db.query(
        'SELECT * FROM sessions WHERE user_id = $1 AND token = $2 AND expires_at > NOW()',
        [decoded.id, token]
      );

      // If no valid session is found, return an error
      if (sessionResult.rows.length === 0) {
        return res.status(401).json({ message: 'Sesión inválida o expirada' });
      }
      
      // Attach the user information to the request object for use in route handlers
      req.user = decoded;
      
      // Continue to the next middleware or route handler
      next();
    } catch (error) {
      // Handle token verification errors
      if (error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({ message: 'Token inválido' });
      } else if (error instanceof jwt.TokenExpiredError) {
        return res.status(401).json({ message: 'Token expirado' });
      } else {
        throw error; // Rethrow unknown errors to be caught by the outer try/catch
      }
    }
  } catch (error) {
    // Log any unexpected errors
    console.error('Error en middleware de autenticación:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};