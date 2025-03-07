// En /controllers/dashboardController.js
const db = require('../db');

exports.getDashboardStats = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Obtener estadísticas de campañas
    const campaignsResult = await db.query(
      'SELECT COUNT(*) as total, COUNT(CASE WHEN status = \'active\' THEN 1 END) as active FROM campaigns WHERE user_id = $1',
      [userId]
    );
    
    // Obtener total de suscriptores
    const subscribersResult = await db.query(
      'SELECT COUNT(s.*) as total FROM subscribers s JOIN campaigns c ON s.campaign_id = c.id WHERE c.user_id = $1',
      [userId]
    );
    
    // Obtener total por fuente (QR vs Link)
    const sourceStatsResult = await db.query(
      'SELECT s.source, COUNT(s.id) as count FROM subscribers s JOIN campaigns c ON s.campaign_id = c.id WHERE c.user_id = $1 GROUP BY s.source',
      [userId]
    );
    
    // Formatear estadísticas por fuente
    const sourceStats = {};
    sourceStatsResult.rows.forEach(row => {
      sourceStats[row.source] = parseInt(row.count);
    });
    
    res.json({
      success: true,
      stats: {
        campaigns: {
          total: parseInt(campaignsResult.rows[0].total),
          active: parseInt(campaignsResult.rows[0].active)
        },
        subscribers: {
          total: parseInt(subscribersResult.rows[0].total),
          bySource: sourceStats
        }
      }
    });
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener estadísticas del dashboard' 
    });
  }
};