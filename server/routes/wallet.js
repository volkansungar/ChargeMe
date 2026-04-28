const express = require('express');
const router = express.Router();
const { getDb } = require('../db');

// GET /api/wallet - Get wallet balance
router.get('/', (req, res) => {
  const db = getDb();
  const wallet = db.prepare('SELECT * FROM wallet WHERE id = 1').get();
  if (!wallet) {
    db.prepare('INSERT INTO wallet (id, balance) VALUES (1, 500.00)').run();
    return res.json({ id: 1, balance: 500.00 });
  }
  res.json(wallet);
});

// POST /api/wallet/topup - Top up wallet
router.post('/topup', (req, res) => {
  const db = getDb();
  const { amount } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Amount must be greater than 0' });
  }

  if (amount > 10000) {
    return res.status(400).json({ error: 'Maximum top-up amount is 10,000 TL' });
  }

  db.prepare('UPDATE wallet SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run(amount);
  const wallet = db.prepare('SELECT * FROM wallet WHERE id = 1').get();
  
  res.json(wallet);
});

module.exports = router;
