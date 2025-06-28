const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
require('dotenv').config();

// Middleware
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(cookieParser());

// Email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Load email template
function getEmailTemplate(link) {
  let template = fs.readFileSync(path.join(__dirname, 'views', 'email', 'verification-email.html'), 'utf8');
  return template.replace('{{verificationLink}}', link);
}

// MongoDB Connection
mongoose.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

// User Schema
const userSchema = new mongoose.Schema({
  email: String,
  username: String,
  password: String,
  profile: {
    name: String,
    bio: String,
    avatar: String,
    links: Array,
    music: String,
  },
  verified: Boolean,
  verificationToken: String,
});

const User = mongoose.model('User', userSchema);

// Middleware - Auth check
const isLoggedIn = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).send('Unauthorized');

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    res.status(401).send('Invalid token');
  }
};

// Serve register.html as homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

// Register
app.post('/register', async (req, res) => {
  const { email, username, password } = req.body;
  const existing = await User.findOne({ $or: [{ email }, { username }] });
  if (existing) return res.status(400).send('Email or username already taken');

  const hashedPass = await bcrypt.hash(password, 8);
  const token = uuidv4();

  const newUser = new User({
    email,
    username,
    password: hashedPass,
    verified: false,
    verificationToken: token,
  });

  await newUser.save();

  const verifyLink = `${process.env.DOMAIN}/verify-email?token=${token}`;
  const html = getEmailTemplate(verifyLink);

  await transporter.sendMail({
    from: `"Hostnet Verify" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Verify Your Hostnet Account',
    html,
  });

  res.redirect('/');
});

// Email Verification
app.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  const user = await User.findOne({ verificationToken: token });
  if (!user) return res.status(400).send('Invalid token');

  user.verified = true;
  user.verificationToken = null;
  await user.save();

  // Redirect to dashboard after verification
  res.redirect('/dashboard');
});

// Login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user || !(await bcrypt.compare(password, user.password)))
    return res.status(400).send('Invalid credentials');

  if (!user.verified) return res.status(403).send('Email not verified');

  const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: '1d',
  });

  res.cookie('token', token, { httpOnly: true });
  res.redirect('/dashboard');
});

// Get Current User Profile
app.get('/profile/me', isLoggedIn, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).send('User not found');
    res.json(user.profile);
  } catch (e) {
    res.status(401).send('Invalid token');
  }
});

// Save Profile
app.post('/save-profile', isLoggedIn, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).send('User not found');

    user.profile = req.body;
    await user.save();
    res.send('Profile saved');
  } catch (e) {
    res.status(401).send('Invalid token');
  }
});

// Public Profile Route
app.get('/:username', async (req, res) => {
  const { username } = req.params;
  const user = await User.findOne({ username });
  if (!user || !user.verified) return res.status(404).send('User not found');

  const profile = user.profile;

  let html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
  html = html
    .replace('<!--NAME-->', profile.name || '')
    .replace('<!--BIO-->', profile.bio || '')
    .replace('<!--AVATAR-->', profile.avatar || '')
    .replace('<!--LINKS-->', (profile.links || []).map(link =>
      `<a href="${link.url}" target="_blank">${link.title}</a>`
    ).join('\n'))
    .replace('<!--MUSIC-->', profile.music || '');

  res.send(html);
});

// Dashboard route
app.get('/dashboard', isLoggedIn, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
