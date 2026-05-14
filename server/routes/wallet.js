const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');

// All wallet routes require authentication
router.use(authMiddleware);

// GET /api/wallet - Get current user's wallet balance
router.get('/', (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, balance FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({ id: user.id, balance: user.balance });
});

// POST /api/wallet/topup - Top up current user's wallet
router.post('/topup', (req, res) => {
  const db = getDb();
  const { amount } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Amount must be greater than 0' });
  }

  if (amount > 10000) {
    return res.status(400).json({ error: 'Maximum top-up amount is 10,000 TL' });
  }

  db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(amount, req.user.id);
  const user = db.prepare('SELECT id, balance FROM users WHERE id = ?').get(req.user.id);
  
  res.json({ id: user.id, balance: user.balance });
});

module.exports = router;
