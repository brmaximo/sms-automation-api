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
    console.log(`API Key configured: ${process.env.RESEND_API_KEY ? 'Yes' : 'No'}`);
    
    // Debugging: Test if the recipient is the special case that works
    const isSpecialCase = to.toLowerCase() === 'maximobriso00@gmail.com';
    console.log(`Is special case email? ${isSpecialCase}`);
    
    const payload = {
      from: `SMS Automation <${fromEmail}>`,
      to,
      subject,
      html: htmlContent,
    };
    
    console.log('Sending with payload:', JSON.stringify(payload, null, 2));
    
    const response = await resend.emails.send(payload);
    
    console.log('Email sent successfully:', response.id);
    return response;
  } catch (error) {
    console.error(`❌ Error sending email to ${to}:`, error);
    
    // Enhanced error logging
    if (error.name) console.error('Error name:', error.name);
    if (error.message) console.error('Error message:', error.message);
    if (error.statusCode) console.error('Status code:', error.statusCode);
    
    // If the error has a Resend API response, log that
    if (error.response) {
      console.error('Resend API error response:', JSON.stringify(error.response, null, 2));
    }
    
    // Log the stack trace for debugging
    console.error('Stack trace:', error.stack);
    
    throw error;
  }
}

// Add a test function to diagnose issues
async function testEmailService() {
  try {
    console.log('⚠️ Testing email service...');
    
    // Test the special case email that's known to work
    await sendEmail(
      'maximobriso00@gmail.com',
      'Test Email - Special Case',
      '<h1>Test Special Case</h1><p>This is a test email to the special case address.</p>'
    );
    
    // Test with a different email address
    await sendEmail(
      'test@example.com', // Change this to another email you own
      'Test Email - Different Address',
      '<h1>Test Different Address</h1><p>This is a test email to a different address.</p>'
    );
    
    console.log('✅ Email service test completed successfully');
  } catch (error) {
    console.error('❌ Email service test failed:', error.message);
  }
}

module.exports = {
  sendEmail,
  testEmailService
};