const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db');
const { JWT_SECRET, authMiddleware } = require('../middleware/auth');

const BCRYPT_ROUNDS = 12;
const TOKEN_EXPIRY = '24h';

// POST /api/auth/register — Create a new user account
router.post('/register', (req, res) => {
  const db = getDb();
  const { username, email, password, confirmPassword } = req.body;

  // Validate required fields
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required.' });
  }

  // Username validation
  if (username.length < 3 || username.length > 30) {
    return res.status(400).json({ error: 'Username must be 3–30 characters.' });
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores.' });
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  // Password validation
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  if (confirmPassword && password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match.' });
  }

  // Check uniqueness
  const existingUser = db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').get(username);
  if (existingUser) {
    return res.status(409).json({ error: 'This username is already taken.' });
  }

  const existingEmail = db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get(email);
  if (existingEmail) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  try {
    const passwordHash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
    const result = db.prepare(
      'INSERT INTO users (username, email, password_hash, role, balance) VALUES (?, ?, ?, ?, ?)'
    ).run(username.trim(), email.trim().toLowerCase(), passwordHash, 'user', 500.00);

    const user = db.prepare('SELECT id, username, email, role, balance, created_at FROM users WHERE id = ?')
      .get(result.lastInsertRowid);

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    res.status(201).json({ token, user });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Failed to create account. Please try again.' });
  }
});

// POST /api/auth/login — Authenticate user and return JWT
router.post('/login', (req, res) => {
  const db = getDb();
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  // Find user by username or email
  const user = db.prepare(
    'SELECT * FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE'
  ).get(username, username);

  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  // Verify password
  const isValid = bcrypt.compareSync(password, user.password_hash);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  // Update last_login
  db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

  // Generate JWT
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      balance: user.balance,
      created_at: user.created_at
    }
  });
});

// GET /api/auth/me — Get current user profile from JWT
router.get('/me', authMiddleware, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, username, email, role, balance, created_at, last_login FROM users WHERE id = ?')
    .get(req.user.id);

  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  res.json(user);
});

module.exports = router;
