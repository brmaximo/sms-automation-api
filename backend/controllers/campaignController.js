const db = require('../db');
const { sendEmail } = require('../emailService');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs').promises;

// Directorio para guardar los códigos QR
const QR_DIR = path.join(__dirname, '../public/qr');

// Asegurar que el directorio para los QR exista
async function ensureQRDir() {
  try {
    await fs.mkdir(QR_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating QR directory:', error);
  }
}

ensureQRDir();

// Crear una nueva campaña
exports.createCampaign = async (req, res) => {
  try {
    const { title, description, incentive } = req.body;
    const userId = req.user.id;

    // Validar datos requeridos
    if (!title) {
      return res.status(400).json({ message: 'El título es obligatorio' });
    }

    // Insertar campaña en la base de datos
    const result = await db.query(
      'INSERT INTO campaigns (user_id, title, description, incentive, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, title, description, incentive, 'active']
    );

    const campaign = result.rows[0];

    // Generar URL única para la landing page
    const landingUrl = `${process.env.FRONTEND_URL}/campaign/${campaign.id}`;
    
    // Generar el código QR
    const qrCodeFileName = `campaign_${campaign.id}_${Date.now()}.png`;
    const qrCodePath = path.join(QR_DIR, qrCodeFileName);
    
    await QRCode.toFile(qrCodePath, landingUrl, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 300
    });
    
    const qrCodeUrl = `${process.env.BACKEND_URL}/public/qr/${qrCodeFileName}`;
    
    // Actualizar la campaña con las URLs
    await db.query(
      'UPDATE campaigns SET landing_url = $1, qr_code_url = $2 WHERE id = $3',
      [landingUrl, qrCodeUrl, campaign.id]
    );

    // Obtener la campaña actualizada
    const updatedResult = await db.query(
      'SELECT * FROM campaigns WHERE id = $1',
      [campaign.id]
    );

    res.status(201).json({
      message: 'Campaña creada exitosamente',
      campaign: updatedResult.rows[0]
    });
  } catch (error) {
    console.error('Error al crear campaña:', error);
    res.status(500).json({ message: 'Error al crear campaña' });
  }
};

// Obtener todas las campañas del usuario
exports.getCampaigns = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await db.query(
      'SELECT * FROM campaigns WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    res.json({ campaigns: result.rows });
  } catch (error) {
    console.error('Error al obtener campañas:', error);
    res.status(500).json({ message: 'Error al obtener campañas' });
  }
};

// Obtener detalles de una campaña específica
exports.getCampaignById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const result = await db.query(
      'SELECT * FROM campaigns WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Campaña no encontrada' });
    }

    const campaign = result.rows[0];

    // Obtener estadísticas de la campaña (suscriptores)
    const statsResult = await db.query(
      'SELECT COUNT(*) as total_subscribers, COUNT(CASE WHEN source = \'qr\' THEN 1 END) as qr_subscribers, COUNT(CASE WHEN source = \'link\' THEN 1 END) as link_subscribers FROM subscribers WHERE campaign_id = $1',
      [id]
    );

    const stats = statsResult.rows[0];

    res.json({
      campaign,
      stats
    });
  } catch (error) {
    console.error('Error al obtener detalles de campaña:', error);
    res.status(500).json({ message: 'Error al obtener detalles de campaña' });
  }
};

// Actualizar una campaña
exports.updateCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, incentive, status } = req.body;
    const userId = req.user.id;

    // Verificar si la campaña existe y pertenece al usuario
    const campaignCheck = await db.query(
      'SELECT * FROM campaigns WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (campaignCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Campaña no encontrada' });
    }

    // Actualizar la campaña
    const result = await db.query(
      'UPDATE campaigns SET title = $1, description = $2, incentive = $3, status = $4, updated_at = NOW() WHERE id = $5 AND user_id = $6 RETURNING *',
      [title, description, incentive, status, id, userId]
    );

    res.json({
      message: 'Campaña actualizada exitosamente',
      campaign: result.rows[0]
    });
  } catch (error) {
    console.error('Error al actualizar campaña:', error);
    res.status(500).json({ message: 'Error al actualizar campaña' });
  }
};

// Eliminar una campaña
exports.deleteCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verificar si la campaña existe y pertenece al usuario
    const campaignCheck = await db.query(
      'SELECT * FROM campaigns WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (campaignCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Campaña no encontrada' });
    }

    // Eliminar la campaña
    await db.query(
      'DELETE FROM campaigns WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    res.json({ message: 'Campaña eliminada exitosamente' });
  } catch (error) {
    console.error('Error al eliminar campaña:', error);
    res.status(500).json({ message: 'Error al eliminar campaña' });
  }
};

// Enviar código QR por email
exports.sendQRCodeByEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verificar si la campaña existe y pertenece al usuario
    const campaignResult = await db.query(
      'SELECT c.*, u.email, u.name FROM campaigns c JOIN users u ON c.user_id = u.id WHERE c.id = $1 AND c.user_id = $2',
      [id, userId]
    );

    if (campaignResult.rows.length === 0) {
      return res.status(404).json({ message: 'Campaña no encontrada' });
    }

    const campaign = campaignResult.rows[0];

    // Si no existe QR, generarlo
    if (!campaign.qr_code_url) {
      return res.status(400).json({ message: 'Esta campaña no tiene código QR generado' });
    }

    // Enviar email con el código QR
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Código QR de tu campaña</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4a69bd; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #777; }
          .qr-container { text-align: center; margin: 20px 0; }
          .campaign-info { margin-bottom: 20px; }
          .button { display: inline-block; background-color: #4a69bd; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Código QR de tu campaña</h1>
          </div>
          <div class="content">
            <div class="campaign-info">
              <h2>${campaign.title}</h2>
              <p>${campaign.description || 'Sin descripción'}</p>
              <p><strong>Incentivo:</strong> ${campaign.incentive || 'No especificado'}</p>
              <p><strong>URL de la landing page:</strong> <a href="${campaign.landing_url}">${campaign.landing_url}</a></p>
            </div>
            
            <div class="qr-container">
              <p>Aquí está el código QR para tu campaña:</p>
              <img src="${campaign.qr_code_url}" alt="Código QR de la campaña" style="max-width: 300px;">
            </div>
            
            <p>Puedes imprimir este código QR o mostrarlo digitalmente para que tus clientes puedan escanearlo.</p>
            
            <div style="text-align: center; margin-top: 20px;">
              <a href="${campaign.landing_url}" class="button">Ver Landing Page</a>
            </div>
          </div>
          <div class="footer">
            <p>&copy; 2025 SMS Automation. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await sendEmail(
      campaign.email,
      `Código QR para tu campaña: ${campaign.title}`,
      htmlContent
    );

    res.json({ message: 'Código QR enviado exitosamente a tu email' });
  } catch (error) {
    console.error('Error al enviar código QR por email:', error);
    res.status(500).json({ message: 'Error al enviar código QR por email' });
  }
};

// Obtener datos públicos de una campaña (para landing page)
exports.getPublicCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const { source } = req.query; // 'qr' o 'link'
    
    const result = await db.query(
      'SELECT id, title, description, incentive FROM campaigns WHERE id = $1 AND status = $2',
      [id, 'active']
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Campaña no encontrada o inactiva' });
    }

    // Registrar la fuente de acceso (para estadísticas)
    if (source === 'qr' || source === 'link') {
      await db.query(
        'UPDATE campaigns SET access_count = access_count + 1, last_accessed = NOW() WHERE id = $1',
        [id]
      );
    }

    res.json({ campaign: result.rows[0] });
  } catch (error) {
    console.error('Error al obtener datos públicos de campaña:', error);
    res.status(500).json({ message: 'Error al obtener datos de campaña' });
  }
};

// Guardar un nuevo suscriptor desde la landing page
exports.addSubscriber = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { name, email, phone, source } = req.body;

    // Validar datos obligatorios
    if (!name || !email || !phone) {
      return res.status(400).json({ message: 'Nombre, email y teléfono son obligatorios' });
    }

    // Verificar si la campaña existe y está activa
    const campaignResult = await db.query(
      'SELECT * FROM campaigns WHERE id = $1 AND status = $2',
      [campaignId, 'active']
    );

    if (campaignResult.rows.length === 0) {
      return res.status(404).json({ message: 'Campaña no encontrada o inactiva' });
    }

    // Verificar si el email ya está registrado en esta campaña
    const duplicateCheck = await db.query(
      'SELECT * FROM subscribers WHERE campaign_id = $1 AND email = $2',
      [campaignId, email]
    );

    if (duplicateCheck.rows.length > 0) {
      return res.status(400).json({ message: 'Este email ya está registrado en esta campaña' });
    }

    // Guardar el nuevo suscriptor
    const result = await db.query(
      'INSERT INTO subscribers (campaign_id, name, email, phone, source) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [campaignId, name, email, phone, source || 'link']
    );

    const subscriber = result.rows[0];

    // Obtener información del propietario de la campaña para enviar notificación
    const ownerResult = await db.query(
      'SELECT u.email, u.name, c.title FROM campaigns c JOIN users u ON c.user_id = u.id WHERE c.id = $1',
      [campaignId]
    );

    if (ownerResult.rows.length > 0) {
      const owner = ownerResult.rows[0];
      const campaign = campaignResult.rows[0];
      
      // Enviar notificación al propietario
      const notificationHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Nuevo suscriptor en tu campaña</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4a69bd; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #777; }
            .subscriber-info { margin: 20px 0; padding: 15px; background-color: #eef2ff; border-radius: 5px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Nuevo suscriptor</h1>
            </div>
            <div class="content">
              <p>Hola ${owner.name},</p>
              <p>Has recibido un nuevo suscriptor en tu campaña "${campaign.title}".</p>
              
              <div class="subscriber-info">
                <p><strong>Nombre:</strong> ${subscriber.name}</p>
                <p><strong>Email:</strong> ${subscriber.email}</p>
                <p><strong>Teléfono:</strong> ${subscriber.phone}</p>
                <p><strong>Fuente:</strong> ${subscriber.source === 'qr' ? 'Código QR' : 'Enlace directo'}</p>
                <p><strong>Fecha:</strong> ${new Date(subscriber.created_at).toLocaleString()}</p>
              </div>
              
              <p>Puedes ver todos tus suscriptores en el dashboard de tu cuenta.</p>
            </div>
            <div class="footer">
              <p>&copy; 2025 SMS Automation. Todos los derechos reservados.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await sendEmail(
        owner.email,
        `Nuevo suscriptor en tu campaña: ${campaign.title}`,
        notificationHtml
      );
    }

    // Enviar confirmación al suscriptor
    const subscriberHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Gracias por suscribirte</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4a69bd; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #777; }
          .incentive { margin: 20px 0; padding: 15px; background-color: #fff3cd; border-left: 4px solid #ffc107; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>¡Gracias por suscribirte!</h1>
          </div>
          <div class="content">
            <p>Hola ${subscriber.name},</p>
            <p>Gracias por registrarte en nuestra campaña "${campaignResult.rows[0].title}".</p>
            
            ${campaignResult.rows[0].incentive ? `
            <div class="incentive">
              <p><strong>Tu incentivo:</strong> ${campaignResult.rows[0].incentive}</p>
            </div>
            ` : ''}
            
            <p>Te mantendremos informado sobre nuestras novedades y promociones.</p>
          </div>
          <div class="footer">
            <p>&copy; 2025 SMS Automation. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await sendEmail(
      subscriber.email,
      `Gracias por suscribirte a ${campaignResult.rows[0].title}`,
      subscriberHtml
    );

    res.status(201).json({
      message: 'Suscripción exitosa',
      subscriber: {
        id: subscriber.id,
        name: subscriber.name,
        email: subscriber.email
      }
    });
  } catch (error) {
    console.error('Error al registrar suscriptor:', error);
    res.status(500).json({ message: 'Error al procesar la suscripción' });
  }
};

// Obtener suscriptores de una campaña
exports.getCampaignSubscribers = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verificar si la campaña existe y pertenece al usuario
    const campaignCheck = await db.query(
      'SELECT * FROM campaigns WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (campaignCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Campaña no encontrada' });
    }

    // Obtener los suscriptores
    const result = await db.query(
      'SELECT * FROM subscribers WHERE campaign_id = $1 ORDER BY created_at DESC',
      [id]
    );

    res.json({ subscribers: result.rows });
  } catch (error) {
    console.error('Error al obtener suscriptores:', error);
    res.status(500).json({ message: 'Error al obtener suscriptores' });
  }
};