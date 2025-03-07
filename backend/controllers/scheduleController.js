const db = require('../db');
const { sendEmail } = require('../emailService');

// Programar una campaña de marketing
exports.scheduleMarketing = async (req, res) => {
  try {
    const { campaignId, templateId, scheduledAt } = req.body;
    const userId = req.user.id;

    // Validar datos requeridos
    if (!campaignId || !templateId || !scheduledAt) {
      return res.status(400).json({ message: 'Id de campaña, plantilla y fecha programada son obligatorios' });
    }

    // Verificar si la campaña existe y pertenece al usuario
    const campaignCheck = await db.query(
      'SELECT * FROM campaigns WHERE id = $1 AND user_id = $2',
      [campaignId, userId]
    );

    if (campaignCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Campaña no encontrada' });
    }

    // Verificar si la plantilla existe y pertenece al usuario
    const templateCheck = await db.query(
      'SELECT * FROM marketing_templates WHERE id = $1 AND user_id = $2',
      [templateId, userId]
    );

    if (templateCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Plantilla no encontrada' });
    }

    // Crear la programación
    const result = await db.query(
      'INSERT INTO campaign_schedules (campaign_id, template_id, scheduled_at, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [campaignId, templateId, scheduledAt, 'pending']
    );

    res.status(201).json({
      message: 'Campaña programada exitosamente',
      schedule: result.rows[0]
    });
  } catch (error) {
    console.error('Error al programar campaña:', error);
    res.status(500).json({ message: 'Error al programar campaña' });
  }
};

// Obtener todas las programaciones del usuario
// Obtener todas las programaciones del usuario
exports.getSchedules = async (req, res) => {
    try {
      const userId = req.user.id;
      
      const result = await db.query(
        `SELECT cs.*, c.title as campaign_title, mt.title as template_title, mt.type as template_type 
         FROM campaign_schedules cs
         JOIN campaigns c ON cs.campaign_id = c.id
         JOIN marketing_templates mt ON cs.template_id = mt.id
         WHERE c.user_id = $1
         ORDER BY cs.scheduled_at DESC`,
        [userId]
      );
  
      res.json({ schedules: result.rows });
    } catch (error) {
      console.error('Error al obtener programaciones:', error);
      res.status(500).json({ message: 'Error al obtener programaciones' });
    }
  };
  
  // Cancelar una programación
  exports.cancelSchedule = async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
  
      // Verificar si la programación existe y pertenece al usuario
      const scheduleCheck = await db.query(
        `SELECT cs.* FROM campaign_schedules cs
         JOIN campaigns c ON cs.campaign_id = c.id
         WHERE cs.id = $1 AND c.user_id = $2`,
        [id, userId]
      );
  
      if (scheduleCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Programación no encontrada' });
      }
  
      // Verificar si la programación ya fue enviada
      if (scheduleCheck.rows[0].status === 'sent') {
        return res.status(400).json({ message: 'No se puede cancelar una campaña ya enviada' });
      }
  
      // Actualizar el estado de la programación
      await db.query(
        'UPDATE campaign_schedules SET status = $1, updated_at = NOW() WHERE id = $2',
        ['cancelled', id]
      );
  
      res.json({ message: 'Programación cancelada exitosamente' });
    } catch (error) {
      console.error('Error al cancelar programación:', error);
      res.status(500).json({ message: 'Error al cancelar programación' });
    }
  };
  
  // Ejecutar manualmente una programación (para pruebas)
  exports.executeSchedule = async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
  
      // Verificar si la programación existe y pertenece al usuario
      const scheduleResult = await db.query(
        `SELECT cs.*, c.title as campaign_title, mt.title as template_title, mt.content as template_content, mt.type as template_type 
         FROM campaign_schedules cs
         JOIN campaigns c ON cs.campaign_id = c.id
         JOIN marketing_templates mt ON cs.template_id = mt.id
         WHERE cs.id = $1 AND c.user_id = $2`,
        [id, userId]
      );
  
      if (scheduleResult.rows.length === 0) {
        return res.status(404).json({ message: 'Programación no encontrada' });
      }
  
      const schedule = scheduleResult.rows[0];
  
      // Verificar si la programación ya fue enviada
      if (schedule.status === 'sent') {
        return res.status(400).json({ message: 'Esta campaña ya fue enviada' });
      }
  
      // Obtener los suscriptores de la campaña
      const subscribersResult = await db.query(
        'SELECT name, email, phone FROM subscribers WHERE campaign_id = $1',
        [schedule.campaign_id]
      );
  
      if (subscribersResult.rows.length === 0) {
        return res.status(400).json({ message: 'No hay suscriptores para esta campaña' });
      }
  
      const subscribers = subscribersResult.rows;
      let successCount = 0;
      let failCount = 0;
  
      // Enviar la campaña a todos los suscriptores
      if (schedule.template_type === 'email') {
        // Para emails, usamos Resend
        for (const subscriber of subscribers) {
          try {
            // Personalizar el contenido con los datos del suscriptor
            let personalizedContent = schedule.template_content
              .replace(/{{name}}/g, subscriber.name)
              .replace(/{{email}}/g, subscriber.email);
  
            await sendEmail(
              subscriber.email,
              `${schedule.campaign_title} - ${schedule.template_title}`,
              personalizedContent
            );
            
            successCount++;
          } catch (error) {
            console.error(`Error enviando email a ${subscriber.email}:`, error);
            failCount++;
          }
        }
      } else if (schedule.template_type === 'sms') {
        // Aquí iría la implementación de SMS (requiere servicio adicional)
        // Por ahora, simulamos que todos los envíos son exitosos
        successCount = subscribers.length;
      }
  
      // Actualizar el estado de la programación
      await db.query(
        'UPDATE campaign_schedules SET status = $1, sent_at = NOW(), updated_at = NOW() WHERE id = $2',
        ['sent', id]
      );
  
      res.json({ 
        message: 'Campaña enviada exitosamente', 
        stats: {
          total: subscribers.length,
          success: successCount,
          failed: failCount
        }
      });
    } catch (error) {
      console.error('Error al ejecutar programación:', error);
      res.status(500).json({ message: 'Error al ejecutar programación' });
    }
  };