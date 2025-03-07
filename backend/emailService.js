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
    const response = await resend.emails.send({
      from: 'SMS Automation <onboarding@resend.dev>', // You can customize this
      to,
      subject,
      html: htmlContent,
    });
    
    console.log('Email sent successfully:', response.id);
    return response;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

module.exports = {
  sendEmail
};