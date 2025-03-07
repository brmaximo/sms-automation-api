// backend/emailService.js
const { Resend } = require('resend');
require('dotenv').config();

// Initialize Resend with API key
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Sends an email using Resend API
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} htmlContent - Email content in HTML format
 * @returns {Promise} - Promise that resolves to Resend API response
 */
async function sendEmail(to, subject, htmlContent) {
  try {
    const fromEmail = process.env.RESEND_FROM || 'noreply@api.yo-towingllc.com';
    
    console.log(`Sending email to: ${to} from: ${fromEmail}`);
    
    const response = await resend.emails.send({
      from: `SMS Automation <${fromEmail}>`,
      to,
      subject,
      html: htmlContent
    });
    
    // Check if response contains an error
    if (response.error) {
      console.error('Resend API returned error:', response.error);
      throw response.error;
    }
    
    console.log(`Email sent successfully with ID: ${response.id}`);
    return response;
  } catch (error) {
    console.error(`Error sending email to ${to}:`, error);
    throw error;
  }
}

module.exports = {
  sendEmail
};