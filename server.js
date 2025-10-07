const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(bodyParser.json());

// In-memory user store (for demo only)
const users = {};
const resetCodes = {};

// Secret key for JWT (in production, use env variable)
const JWT_SECRET = 'supersecretkey';

// Email transporter (SendGrid SMTP)
const transporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_SECURE === 'true', // false for TLS
  auth: {
    user: process.env.SMTP_USER || 'apikey',
    pass: process.env.SMTP_PASS || 'your-sendgrid-api-key'
  }
});

// Multer setup for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Register endpoint (direct registration without verification)
app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  if (users[email]) {
    return res.status(400).json({ error: 'User already exists' });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    users[email] = { password: hashedPassword };
    res.json({ message: 'Account created successfully' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});



// Forgot password
app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!users[email]) {
    return res.status(400).json({ error: 'User not found' });
  }
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  resetCodes[email] = { code, expires: Date.now() + 10 * 60 * 1000 };
  try {
    await transporter.sendMail({
      from: 'noreply@fusionai.com',
      to: email,
      subject: 'Reset your FusionAI password',
      text: `Your reset code is: ${code}. It expires in 10 minutes.`
    });
    res.json({ message: 'Reset code sent to your email' });
  } catch (error) {
    console.error('Email send error:', error);
    res.status(500).json({ error: 'Failed to send reset email' });
  }
});

// Reset password
app.post('/api/reset-password', async (req, res) => {
  const { email, code, newPassword } = req.body;
  const data = resetCodes[email];
  if (!data || data.code !== code || Date.now() > data.expires) {
    return res.status(400).json({ error: 'Invalid or expired code' });
  }
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  users[email].password = hashedPassword;
  delete resetCodes[email];
  res.json({ message: 'Password reset successfully' });
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

app.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`);
});
