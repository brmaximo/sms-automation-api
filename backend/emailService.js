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
    // Use the RESEND_FROM value from environment variables
    const fromEmail = process.env.RESEND_FROM || 'onboarding@resend.dev';
    
    // Log the email being sent for debugging
    console.log(`Attempting to send email to: ${to} from: ${fromEmail}`);
    
    const response = await resend.emails.send({
      from: `SMS Automation <${fromEmail}>`,
      to, // This should accept any email address
      subject,
      html: htmlContent,
    });
    
    console.log('Email sent successfully:', response.id);
    return response;
  } catch (error) {
    console.error('Error sending email:', error);
    console.error('Error details:', error.message);
    // If there are more error details in the response, log those as well
    if (error.response) {
      console.error('Error response:', error.response);
    }
    throw error;
  }
}

module.exports = {
  sendEmail
};