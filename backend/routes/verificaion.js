const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../db');
const nodemailer = require('nodemailer');
const authMiddleware = require('../middleware/auth');

// Configure email transporter (update with your SMTP settings)
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Send verification email
router.post('/send', authMiddleware, async (req, res) => {
  try {
    // Check if user is already verified
    const userResult = await db.query(
      'SELECT verified FROM users WHERE id = $1',
      [req.user.id]
    );
    
    if (userResult.rows[0].verified) {
      return res.status(400).json({ message: 'Email already verified' });
    }

    // Generate verification token
    const token = jwt.sign(
      { id: req.user.id, email: req.user.email, type: 'email_verification' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // Store token in database
    await db.query(
      'INSERT INTO verification_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'24 hours\')',
      [req.user.id, token]
    );
    
    // Send email
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
    
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: req.user.email,
      subject: 'Verify Your Email Address',
      html: `
        <h1>Email Verification</h1>
        <p>Please click the link below to verify your email address:</p>
        <a href="${verificationUrl}">Verify Email</a>
        <p>This link will expire in 24 hours.</p>
      `
    });
    
    res.json({ message: 'Verification email sent' });
  } catch (error) {
    console.error('Error sending verification email:', error);
    res.status(500).json({ message: 'Error sending verification email' });
  }
});

// Verify email with token
router.get('/verify/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      if (decoded.type !== 'email_verification') {
        return res.status(400).json({ message: 'Invalid verification token' });
      }
      
      // Check if token exists in database and is not expired
      const tokenResult = await db.query(
        'SELECT * FROM verification_tokens WHERE token = $1 AND expires_at > NOW()',
        [token]
      );
      
      if (tokenResult.rows.length === 0) {
        return res.status(400).json({ message: 'Token expired or invalid' });
      }
      
      // Mark user as verified
      await db.query(
        'UPDATE users SET verified = TRUE WHERE id = $1',
        [decoded.id]
      );
      
      // Delete used token
      await db.query(
        'DELETE FROM verification_tokens WHERE token = $1',
        [token]
      );
      
      res.json({ message: 'Email verified successfully' });
    } catch (error) {
      return res.status(400).json({ message: 'Invalid verification token' });
    }
  } catch (error) {
    console.error('Error verifying email:', error);
    res.status(500).json({ message: 'Error verifying email' });
  }
});

// Resend verification email
router.post('/resend', authMiddleware, async (req, res) => {
  try {
    // Check if user is already verified
    const userResult = await db.query(
      'SELECT verified FROM users WHERE id = $1',
      [req.user.id]
    );
    
    if (userResult.rows[0].verified) {
      return res.status(400).json({ message: 'Email already verified' });
    }
    
    // Delete old tokens
    await db.query(
      'DELETE FROM verification_tokens WHERE user_id = $1',
      [req.user.id]
    );
    
    // Generate new token
    const token = jwt.sign(
      { id: req.user.id, email: req.user.email, type: 'email_verification' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // Store token in database
    await db.query(
      'INSERT INTO verification_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'24 hours\')',
      [req.user.id, token]
    );
    
    // Send email
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
    
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: req.user.email,
      subject: 'Verify Your Email Address',
      html: `
        <h1>Email Verification</h1>
        <p>Please click the link below to verify your email address:</p>
        <a href="${verificationUrl}">Verify Email</a>
        <p>This link will expire in 24 hours.</p>
      `
    });
    
    res.json({ message: 'Verification email sent' });
  } catch (error) {
    console.error('Error resending verification email:', error);
    res.status(500).json({ message: 'Error resending verification email' });
  }
});

// Check verification status
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT verified FROM users WHERE id = $1',
      [req.user.id]
    );
    
    res.json({ verified: result.rows[0].verified });
  } catch (error) {
    console.error('Error checking verification status:', error);
    res.status(500).json({ message: 'Error checking verification status' });
  }
});

module.exports = router;