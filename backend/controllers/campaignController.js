// En /controllers/campaignController.js - nuevo método
exports.searchCampaigns = async (req, res) => {
    try {
      const userId = req.user.id;
      const { query, status, sortBy, order } = req.query;
      
      let sqlQuery = 'SELECT * FROM campaigns WHERE user_id = $1';
      let params = [userId];
      let paramCount = 2;
      
      // Añadir filtros si existen
      if (query) {
        sqlQuery += ` AND (title ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
        params.push(`%${query}%`);
        paramCount++;
      }
      
      if (status && ['active', 'inactive'].includes(status)) {
        sqlQuery += ` AND status = $${paramCount}`;
        params.push(status);
        paramCount++;
      }
      
      // Añadir ordenamiento
      sqlQuery += ` ORDER BY ${sortBy || 'created_at'} ${order === 'asc' ? 'ASC' : 'DESC'}`;
      
      const result = await db.query(sqlQuery, params);
      
      res.json({
        success: true,
        campaigns: result.rows
      });
    } catch (error) {
      console.error('Error searching campaigns:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error al buscar campañas' 
      });
    }
  };