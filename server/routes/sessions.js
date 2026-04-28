const express = require('express');
const router = express.Router();
const { getDb } = require('../db');

// GET /api/sessions - List all sessions (history)
router.get('/', (req, res) => {
  const db = getDb();
  const sessions = db.prepare(`
    SELECT s.*,
      c.charger_label, c.type as charger_type, c.power_kw, c.connector_type as charger_connector, c.price_per_kwh,
      st.name as station_name, st.address,
      v.brand as vehicle_brand, v.model as vehicle_model, v.plate_number, v.battery_capacity
    FROM sessions s
    JOIN chargers c ON s.charger_id = c.id
    JOIN stations st ON c.station_id = st.id
    JOIN vehicles v ON s.vehicle_id = v.id
    ORDER BY s.started_at DESC
  `).all();
  res.json(sessions);
});

// POST /api/sessions/start - Start a charging session
router.post('/start', (req, res) => {
  const db = getDb();
  const { reservation_id, vehicle_id, charger_id, start_kwh } = req.body;

  if (!vehicle_id || !charger_id) {
    return res.status(400).json({ error: 'Vehicle and charger are required' });
  }

  // Check wallet balance
  const wallet = db.prepare('SELECT balance FROM wallet WHERE id = 1').get();
  if (wallet.balance <= 0) {
    return res.status(400).json({ error: 'Insufficient wallet balance. Please top up.' });
  }

  // Mark reservation as active if provided
  if (reservation_id) {
    db.prepare("UPDATE reservations SET status = 'active' WHERE id = ?").run(reservation_id);
  }

  // Mark charger as occupied
  db.prepare("UPDATE chargers SET status = 'occupied' WHERE id = ?").run(charger_id);

  const result = db.prepare(`
    INSERT INTO sessions (reservation_id, vehicle_id, charger_id, start_kwh, current_kwh)
    VALUES (?, ?, ?, ?, ?)
  `).run(reservation_id || null, vehicle_id, charger_id, start_kwh || 0, start_kwh || 0);

  const session = db.prepare(`
    SELECT s.*,
      c.charger_label, c.power_kw, c.price_per_kwh,
      st.name as station_name,
      v.brand as vehicle_brand, v.model as vehicle_model, v.battery_capacity
    FROM sessions s
    JOIN chargers c ON s.charger_id = c.id
    JOIN stations st ON c.station_id = st.id
    JOIN vehicles v ON s.vehicle_id = v.id
    WHERE s.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(session);
});

// PUT /api/sessions/:id/update - Update session progress (simulated)
router.put('/:id/update', (req, res) => {
  const db = getDb();
  const { current_kwh } = req.body;

  const session = db.prepare(`
    SELECT s.*, c.price_per_kwh
    FROM sessions s
    JOIN chargers c ON s.charger_id = c.id
    WHERE s.id = ?
  `).get(req.params.id);

  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (session.status === 'completed') return res.status(400).json({ error: 'Session already completed' });

  const consumed = current_kwh - session.start_kwh;
  const cost = Math.round(consumed * session.price_per_kwh * 100) / 100;

  db.prepare(`
    UPDATE sessions SET current_kwh = ?, consumed_kwh = ?, cost = ?
    WHERE id = ?
  `).run(current_kwh, consumed, cost, req.params.id);

  const updated = db.prepare(`
    SELECT s.*,
      c.charger_label, c.power_kw, c.price_per_kwh,
      st.name as station_name,
      v.brand as vehicle_brand, v.model as vehicle_model, v.battery_capacity
    FROM sessions s
    JOIN chargers c ON s.charger_id = c.id
    JOIN stations st ON c.station_id = st.id
    JOIN vehicles v ON s.vehicle_id = v.id
    WHERE s.id = ?
  `).get(req.params.id);

  res.json(updated);
});

// PUT /api/sessions/:id/end - End a charging session
router.put('/:id/end', (req, res) => {
  const db = getDb();
  const { end_kwh } = req.body;

  const session = db.prepare(`
    SELECT s.*, c.price_per_kwh, c.charger_label
    FROM sessions s
    JOIN chargers c ON s.charger_id = c.id
    WHERE s.id = ?
  `).get(req.params.id);

  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (session.status === 'completed') return res.status(400).json({ error: 'Session already completed' });

  const finalKwh = end_kwh || session.current_kwh;
  const consumed = finalKwh - session.start_kwh;
  const cost = Math.round(consumed * session.price_per_kwh * 100) / 100;

  // End the session
  db.prepare(`
    UPDATE sessions 
    SET end_kwh = ?, consumed_kwh = ?, cost = ?, status = 'completed', ended_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(finalKwh, consumed, cost, req.params.id);

  // Deduct from wallet
  db.prepare('UPDATE wallet SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run(cost);

  // Mark reservation as completed if exists
  if (session.reservation_id) {
    db.prepare("UPDATE reservations SET status = 'completed' WHERE id = ?").run(session.reservation_id);
  }

  // Mark charger as available again
  db.prepare("UPDATE chargers SET status = 'available' WHERE id = ?").run(session.charger_id);

  const completed = db.prepare(`
    SELECT s.*,
      c.charger_label, c.type as charger_type, c.power_kw, c.connector_type as charger_connector, c.price_per_kwh,
      st.name as station_name, st.address,
      v.brand as vehicle_brand, v.model as vehicle_model, v.plate_number, v.battery_capacity
    FROM sessions s
    JOIN chargers c ON s.charger_id = c.id
    JOIN stations st ON c.station_id = st.id
    JOIN vehicles v ON s.vehicle_id = v.id
    WHERE s.id = ?
  `).get(req.params.id);

  const wallet = db.prepare('SELECT balance FROM wallet WHERE id = 1').get();

  res.json({ session: completed, wallet_balance: wallet.balance });
});

module.exports = router;
