// En /controllers/subscriberController.js (nuevo archivo)
const db = require('../db');
const { Parser } = require('json2csv');

exports.exportSubscribers = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const userId = req.user.id;
    const { format } = req.query;
    
    // Verificar que la campaña pertenece al usuario
    const campaignCheck = await db.query(
      'SELECT id FROM campaigns WHERE id = $1 AND user_id = $2',
      [campaignId, userId]
    );
    
    if (campaignCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Campaña no encontrada' });
    }
    
    // Obtener suscriptores
    const result = await db.query(
      'SELECT name, email, phone, source, created_at FROM subscribers WHERE campaign_id = $1',
      [campaignId]
    );
    
    if (format === 'csv') {
      // Exportar como CSV
      const fields = ['name', 'email', 'phone', 'source', 'created_at'];
      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(result.rows);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=subscribers_${campaignId}.csv`);
      return res.send(csv);
    }
    
    // Por defecto devolver JSON
    res.json({
      success: true,
      subscribers: result.rows
    });
  } catch (error) {
    console.error('Error exporting subscribers:', error);
    res.status(500).json({ message: 'Error al exportar suscriptores' });
  }
};