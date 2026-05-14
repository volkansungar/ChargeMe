const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');

// All reservation routes require authentication
router.use(authMiddleware);

// GET /api/reservations - List current user's reservations
router.get('/', (req, res) => {
  const db = getDb();
  const reservations = db.prepare(`
    SELECT r.*, 
      c.charger_label, c.type as charger_type, c.power_kw, c.connector_type as charger_connector, c.price_per_kwh,
      s.name as station_name, s.lat, s.lng, s.address,
      v.brand as vehicle_brand, v.model as vehicle_model, v.plate_number
    FROM reservations r
    JOIN chargers c ON r.charger_id = c.id
    JOIN stations s ON c.station_id = s.id
    JOIN vehicles v ON r.vehicle_id = v.id
    WHERE r.user_id = ?
    ORDER BY r.reservation_date DESC, r.start_time DESC
  `).all(req.user.id);
  res.json(reservations);
});

// POST /api/reservations - Create a new reservation
router.post('/', (req, res) => {
  const db = getDb();
  const { vehicle_id, charger_id, reservation_date, start_time, end_time } = req.body;

  // Validate required fields
  if (!vehicle_id || !charger_id || !reservation_date || !start_time || !end_time) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  // Verify vehicle belongs to user
  const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ? AND user_id = ?').get(vehicle_id, req.user.id);
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

  const charger = db.prepare('SELECT c.*, s.name as station_name, s.status as station_status FROM chargers c JOIN stations s ON c.station_id = s.id WHERE c.id = ?').get(charger_id);
  if (!charger) return res.status(404).json({ error: 'Charger not found' });

  // Check station is not offline
  if (charger.station_status === 'offline') {
    return res.status(400).json({ error: 'This station is currently offline' });
  }

  // Check charger is not out of service
  if (charger.status === 'out_of_service') {
    return res.status(400).json({ error: 'This charger is currently out of service' });
  }

  // Compatibility check: connector type
  if (vehicle.connector_type !== charger.connector_type) {
    return res.status(400).json({ 
      error: `Incompatible connector. Your vehicle uses ${vehicle.connector_type} but this charger has ${charger.connector_type}` 
    });
  }

  // Time validation: max 2 hours
  const startParts = start_time.split(':').map(Number);
  const endParts = end_time.split(':').map(Number);
  const startMinutes = startParts[0] * 60 + startParts[1];
  const endMinutes = endParts[0] * 60 + endParts[1];
  const durationMinutes = endMinutes - startMinutes;

  if (durationMinutes <= 0) {
    return res.status(400).json({ error: 'End time must be after start time' });
  }

  if (durationMinutes > 120) {
    return res.status(400).json({ error: 'Maximum session duration is 2 hours' });
  }

  // Time validation: max 24 hours in advance
  const now = new Date();
  const reservationDateTime = new Date(`${reservation_date}T${start_time}`);
  const hoursInAdvance = (reservationDateTime - now) / (1000 * 60 * 60);

  if (hoursInAdvance < 0) {
    return res.status(400).json({ error: 'Cannot reserve in the past' });
  }

  if (hoursInAdvance > 24) {
    return res.status(400).json({ error: 'Cannot reserve more than 24 hours in advance' });
  }

  // Conflict check: double-booking
  const conflict = db.prepare(`
    SELECT * FROM reservations 
    WHERE charger_id = ? 
    AND reservation_date = ? 
    AND status IN ('confirmed', 'active')
    AND (
      (start_time < ? AND end_time > ?) OR
      (start_time < ? AND end_time > ?) OR
      (start_time >= ? AND end_time <= ?)
    )
  `).get(
    charger_id, reservation_date,
    end_time, start_time,
    end_time, start_time,
    start_time, end_time
  );

  if (conflict) {
    return res.status(409).json({ error: 'This time slot is already booked. Please choose a different time.' });
  }

  // Check wallet balance for reservation fee (R10)
  const HOLDING_FEE = 20.0;
  const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(req.user.id);
  if (user.balance < HOLDING_FEE) {
    return res.status(400).json({ error: `Insufficient wallet balance. A holding fee of ₺${HOLDING_FEE} is required.` });
  }

  const transaction = db.transaction(() => {
    // Deduct fee from user's balance
    db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(HOLDING_FEE, req.user.id);

    // Create reservation
    const result = db.prepare(
      'INSERT INTO reservations (user_id, vehicle_id, charger_id, reservation_date, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(req.user.id, vehicle_id, charger_id, reservation_date, start_time, end_time);

    return result.lastInsertRowid;
  });

  try {
    const newReservationId = transaction();

    const reservation = db.prepare(`
      SELECT r.*, 
        c.charger_label, c.type as charger_type, c.power_kw, c.connector_type as charger_connector, c.price_per_kwh,
        s.name as station_name, s.lat, s.lng, s.address,
        v.brand as vehicle_brand, v.model as vehicle_model, v.plate_number
      FROM reservations r
      JOIN chargers c ON r.charger_id = c.id
      JOIN stations s ON c.station_id = s.id
      JOIN vehicles v ON r.vehicle_id = v.id
      WHERE r.id = ?
    `).get(newReservationId);

    res.status(201).json(reservation);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create reservation' });
  }
});

// DELETE /api/reservations/:id - Cancel a reservation (must belong to user)
router.delete('/:id', (req, res) => {
  const db = getDb();
  const reservation = db.prepare('SELECT * FROM reservations WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!reservation) return res.status(404).json({ error: 'Reservation not found' });

  if (reservation.status === 'completed') {
    return res.status(400).json({ error: 'Cannot cancel a completed reservation' });
  }

  const transaction = db.transaction(() => {
    db.prepare("UPDATE reservations SET status = 'cancelled' WHERE id = ?").run(req.params.id);
    // Refund holding fee to user's balance (R10)
    db.prepare('UPDATE users SET balance = balance + 20 WHERE id = ?').run(req.user.id);
  });

  try {
    transaction();
    res.json({ message: 'Reservation cancelled successfully and ₺20 refunded to wallet.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel reservation' });
  }
});

module.exports = router;
