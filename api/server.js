require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');

const app = express();

app.use(cors());
app.use(bodyParser.json());

// In-memory user store (for demo only)
const users = {};
const verificationCodes = {};
const resetCodes = {};

// Secret key for JWT (in production, use env variable)
const JWT_SECRET = 'supersecretkey';

// Email transporter setup - Configure with real SMTP service
const transporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST || 'smtp.gmail.com', // Use Gmail SMTP
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true' || false, // false for 587, true for 465
  auth: {
    user: process.env.SMTP_USER, // Your Gmail address
    pass: process.env.SMTP_PASS   // Your Gmail app password (not regular password)
  },
  // Additional Gmail-specific settings
  tls: {
    rejectUnauthorized: false
  }
});

// Multer setup for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Register endpoint
app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  if (users[email]) {
    return res.status(400).json({ error: 'User already exists' });
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
  users[email] = { password: hashedPassword, verified: false };
  verificationCodes[email] = verificationCode;

  // Send verification email
  try {
    const info = await transporter.sendMail({
      from: '"FusionAI" <noreply@fusionai.com>',
      to: email,
      subject: 'Verify your email',
      text: `Your verification code is: ${verificationCode}`,
      html: `<p>Your verification code is: <strong>${verificationCode}</strong></p>`
    });
    console.log('Verification email sent:', info.messageId);
    console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
    res.json({ message: 'Verification code sent to your email' });
  } catch (error) {
    console.error('Email send error:', error);
    res.status(500).json({ error: 'Failed to send verification email' });
  }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = users[email];
  if (!user) {
    return res.status(400).json({ error: 'Invalid email or password' });
  }
  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.status(400).json({ error: 'Invalid email or password' });
  }
  if (!user.verified) {
    return res.status(400).json({ error: 'Please verify your email first' });
  }
  const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '1h' });
  res.json({ token });
});

// Middleware to verify JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// File upload endpoint
app.post('/api/upload', authenticateToken, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  // For demo, just return file info and base64 content
  const fileData = req.file.buffer.toString('base64');
  res.json({
    filename: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    base64: fileData
  });
});

// Proxy AI chat endpoint (forwards request to AI API)
app.post('/api/chat', authenticateToken, async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }
  try {
    const response = await fetch("https://backend.buildpicoapps.com/aero/run/llm-api?pk=v1-Z0FBQUFBQm5IZkJDMlNyYUVUTjIyZVN3UWFNX3BFTU85SWpCM2NUMUk3T2dxejhLSzBhNWNMMXNzZlp3c09BSTR6YW1Sc1BmdGNTVk1GY0liT1RoWDZZX1lNZlZ0Z1dqd3c9PQ==", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'AI API request failed' });
  }
});

// Verify email endpoint
app.post('/api/verify', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: 'Email and code required' });
  }
  if (verificationCodes[email] !== code) {
    return res.status(400).json({ error: 'Invalid verification code' });
  }
  if (users[email]) {
    users[email].verified = true;
    delete verificationCodes[email];
    res.json({ message: 'Email verified successfully' });
  } else {
    res.status(400).json({ error: 'User not found' });
  }
});

// Forgot password endpoint
app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }
  if (!users[email]) {
    return res.status(400).json({ error: 'User not found' });
  }
  const resetCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
  resetCodes[email] = resetCode;

  // Send reset email
  try {
    await transporter.sendMail({
      from: '"FusionAI" <noreply@fusionai.com>',
      to: email,
      subject: 'Reset your password',
      text: `Your reset code is: ${resetCode}`,
      html: `<p>Your reset code is: <strong>${resetCode}</strong></p>`
    });
    res.json({ message: 'Reset code sent to your email' });
  } catch (error) {
    console.error('Email send error:', error);
    res.status(500).json({ error: 'Failed to send reset email' });
  }
});

// Reset password endpoint
app.post('/api/reset-password', async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: 'Email, code, and new password required' });
  }
  if (resetCodes[email] !== code) {
    return res.status(400).json({ error: 'Invalid reset code' });
  }
  if (users[email]) {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    users[email].password = hashedPassword;
    delete resetCodes[email];
    res.json({ message: 'Password reset successfully' });
  } else {
    res.status(400).json({ error: 'User not found' });
  }
});

module.exports = app;
