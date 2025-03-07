const db = require('../db');

// Crear una nueva plantilla de marketing
exports.createTemplate = async (req, res) => {
  try {
    const { title, content, type } = req.body;
    const userId = req.user.id;

    // Validar datos requeridos
    if (!title || !content) {
      return res.status(400).json({ message: 'Título y contenido son obligatorios' });
    }

    // Validar tipo
    if (type !== 'email' && type !== 'sms') {
      return res.status(400).json({ message: 'Tipo debe ser email o sms' });
    }

    // Insertar plantilla en la base de datos
    const result = await db.query(
      'INSERT INTO marketing_templates (user_id, title, content, type) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, title, content, type]
    );

    res.status(201).json({
      message: 'Plantilla creada exitosamente',
      template: result.rows[0]
    });
  } catch (error) {
    console.error('Error al crear plantilla:', error);
    res.status(500).json({ message: 'Error al crear plantilla' });
  }
};

// Obtener todas las plantillas del usuario
exports.getTemplates = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await db.query(
      'SELECT * FROM marketing_templates WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    res.json({ templates: result.rows });
  } catch (error) {
    console.error('Error al obtener plantillas:', error);
    res.status(500).json({ message: 'Error al obtener plantillas' });
  }
};

// Obtener detalles de una plantilla específica
exports.getTemplateById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const result = await db.query(
      'SELECT * FROM marketing_templates WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Plantilla no encontrada' });
    }

    res.json({ template: result.rows[0] });
  } catch (error) {
    console.error('Error al obtener detalles de plantilla:', error);
    res.status(500).json({ message: 'Error al obtener detalles de plantilla' });
  }
};

// Actualizar una plantilla
exports.updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, type } = req.body;
    const userId = req.user.id;

    // Verificar si la plantilla existe y pertenece al usuario
    const templateCheck = await db.query(
      'SELECT * FROM marketing_templates WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (templateCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Plantilla no encontrada' });
    }

    // Validar tipo
    if (type && type !== 'email' && type !== 'sms') {
      return res.status(400).json({ message: 'Tipo debe ser email o sms' });
    }

    // Actualizar la plantilla
    const result = await db.query(
      'UPDATE marketing_templates SET title = $1, content = $2, type = $3, updated_at = NOW() WHERE id = $4 AND user_id = $5 RETURNING *',
      [title, content, type, id, userId]
    );

    res.json({
      message: 'Plantilla actualizada exitosamente',
      template: result.rows[0]
    });
  } catch (error) {
    console.error('Error al actualizar plantilla:', error);
    res.status(500).json({ message: 'Error al actualizar plantilla' });
  }
};

// Eliminar una plantilla
exports.deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verificar si la plantilla existe y pertenece al usuario
    const templateCheck = await db.query(
      'SELECT * FROM marketing_templates WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (templateCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Plantilla no encontrada' });
    }

    // Eliminar la plantilla
    await db.query(
      'DELETE FROM marketing_templates WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    res.json({ message: 'Plantilla eliminada exitosamente' });
  } catch (error) {
    console.error('Error al eliminar plantilla:', error);
    res.status(500).json({ message: 'Error al eliminar plantilla' });
  }
};