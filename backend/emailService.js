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
    
    console.log(`Attempting to send email to: ${to} from: ${fromEmail}`);
    
    // Check if this is an email other than the working one
    const knownWorkingEmail = 'maximobrisoc@gmail.com';
    let emailRecipient = to;
    
    // For non-working email addresses, use a workaround technique
    if (to.toLowerCase() !== knownWorkingEmail.toLowerCase()) {
      console.log(`⚠️ Email address ${to} is not the known working email.`);
      console.log(`⚠️ Setting recipient to ${knownWorkingEmail} but keeping original address in subject line`);
      
      // Add the original recipient to the subject for identification
      subject = `[To: ${to}] ${subject}`;
      
      // Change recipient to the known working email
      emailRecipient = knownWorkingEmail;
      
      // Add a note in the email body about the intended recipient
      const recipientNote = `
        <div style="background-color: #fff3cd; padding: 10px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <p style="margin: 0; color: #856404;"><strong>Note:</strong> This email was intended for: ${to}</p>
        </div>
      `;
      
      // Insert the note at the beginning of the HTML content
      htmlContent = recipientNote + htmlContent;
    }
    
    // Send email to the appropriate recipient
    const response = await resend.emails.send({
      from: `SMS Automation <${fromEmail}>`,
      to: emailRecipient,
      subject,
      html: htmlContent,
    });
    
    console.log(`Email sent successfully to ${emailRecipient} (intended for ${to}):`, response);
    return response;
  } catch (error) {
    console.error(`Error sending email to ${to}:`, error);
    
    // Enhanced error logging
    if (error.name) console.error('Error name:', error.name);
    if (error.message) console.error('Error message:', error.message);
    if (error.statusCode) console.error('Status code:', error.statusCode);
    
    // If there are more error details in the response, log those as well
    if (error.response) {
      console.error('Resend API error response:', error.response);
    }
    
    throw error;
  }
}

module.exports = {
  sendEmail
};