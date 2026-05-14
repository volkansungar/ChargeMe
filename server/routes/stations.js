const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { authMiddleware, requireRole, optionalAuth } = require('../middleware/auth');

// GET /api/stations - List all stations with chargers (public)
router.get('/', (req, res) => {
  const db = getDb();
  const stations = db.prepare('SELECT * FROM stations ORDER BY name').all();

  // Attach chargers to each station
  const getChargers = db.prepare('SELECT * FROM chargers WHERE station_id = ?');
  const result = stations.map(station => ({
    ...station,
    chargers: getChargers.all(station.id)
  }));

  res.json(result);
});

// GET /api/stations/favorites/list - List favorite stations (requires auth)
router.get('/favorites/list', authMiddleware, (req, res) => {
  const db = getDb();
  const favorites = db.prepare(`
    SELECT s.* FROM stations s
    JOIN favorites f ON s.id = f.station_id
    WHERE f.user_id = ?
    ORDER BY f.created_at DESC
  `).all(req.user.id);
  res.json(favorites);
});

// GET /api/stations/:id - Station detail with chargers and availability (public)
router.get('/:id', (req, res) => {
  const db = getDb();
  const station = db.prepare('SELECT * FROM stations WHERE id = ?').get(req.params.id);
  if (!station) return res.status(404).json({ error: 'Station not found' });

  const chargers = db.prepare('SELECT * FROM chargers WHERE station_id = ?').all(station.id);

  // Get active reservations for each charger
  const getActiveReservations = db.prepare(`
    SELECT r.*, v.brand, v.model, v.plate_number
    FROM reservations r
    JOIN vehicles v ON r.vehicle_id = v.id
    WHERE r.charger_id = ? AND r.status IN ('confirmed', 'active')
    AND r.reservation_date >= date('now')
    ORDER BY r.reservation_date, r.start_time
  `);

  const chargersWithAvailability = chargers.map(charger => ({
    ...charger,
    reservations: getActiveReservations.all(charger.id)
  }));

  res.json({ ...station, chargers: chargersWithAvailability });
});

// GET /api/stations/:id/favorite - Check if favorited by current user
router.get('/:id/favorite', authMiddleware, (req, res) => {
  const db = getDb();
  const fav = db.prepare('SELECT * FROM favorites WHERE station_id = ? AND user_id = ?').get(req.params.id, req.user.id);
  res.json({ isFavorite: !!fav });
});

// POST /api/stations/:id/favorite - Toggle favorite for current user
router.post('/:id/favorite', authMiddleware, (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM favorites WHERE station_id = ? AND user_id = ?').get(req.params.id, req.user.id);
  
  if (existing) {
    db.prepare('DELETE FROM favorites WHERE station_id = ? AND user_id = ?').run(req.params.id, req.user.id);
    res.json({ isFavorite: false });
  } else {
    db.prepare('INSERT INTO favorites (user_id, station_id) VALUES (?, ?)').run(req.user.id, req.params.id);
    res.json({ isFavorite: true });
  }
});

// Admin endpoints — require admin role
const adminAuth = [authMiddleware, requireRole('admin')];

// PUT /api/stations/:id - Update station operating hours
router.put('/:id', ...adminAuth, (req, res) => {
  const db = getDb();
  const { operating_hours } = req.body;
  
  if (!operating_hours) return res.status(400).json({ error: 'Operating hours required' });

  db.prepare('UPDATE stations SET operating_hours = ? WHERE id = ?').run(operating_hours, req.params.id);
  const station = db.prepare('SELECT * FROM stations WHERE id = ?').get(req.params.id);
  res.json(station);
});

// PUT /api/stations/:stationId/chargers/:chargerId - Update charger price & hardware
router.put('/:stationId/chargers/:chargerId', ...adminAuth, (req, res) => {
  const db = getDb();
  const { price_per_kwh, power_kw, connector_type } = req.body;
  
  if (!price_per_kwh || price_per_kwh <= 0) {
    return res.status(400).json({ error: 'Valid price per kWh is required' });
  }

  const current = db.prepare('SELECT * FROM chargers WHERE id = ?').get(req.params.chargerId);
  const newPower = power_kw || current.power_kw;
  const newConnector = connector_type || current.connector_type;

  db.prepare('UPDATE chargers SET price_per_kwh = ?, power_kw = ?, connector_type = ? WHERE id = ? AND station_id = ?').run(
    price_per_kwh, newPower, newConnector, req.params.chargerId, req.params.stationId
  );
  
  const charger = db.prepare('SELECT * FROM chargers WHERE id = ?').get(req.params.chargerId);
  res.json(charger);
});

// PUT /api/stations/:stationId/chargers/:chargerId/status - Update charger status
router.put('/:stationId/chargers/:chargerId/status', ...adminAuth, (req, res) => {
  const db = getDb();
  const { status } = req.body;
  const validStatuses = ['available', 'occupied', 'out_of_service'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  const transaction = db.transaction(() => {
    // 1. Update charger status
    db.prepare('UPDATE chargers SET status = ? WHERE id = ? AND station_id = ?').run(
      status, req.params.chargerId, req.params.stationId
    );

    // 2. Auto-cancel reservations if out of service (Requirement R16)
    let cancelledCount = 0;
    if (status === 'out_of_service') {
      // Get reservations to cancel and refund each user
      const reservationsToCancel = db.prepare(`
        SELECT id, user_id FROM reservations 
        WHERE charger_id = ? AND status IN ('confirmed', 'active')
      `).all(req.params.chargerId);

      for (const reservation of reservationsToCancel) {
        db.prepare("UPDATE reservations SET status = 'cancelled' WHERE id = ?").run(reservation.id);
        // Refund the 20 TL holding fee to each user (R17)
        db.prepare('UPDATE users SET balance = balance + 20 WHERE id = ?').run(reservation.user_id);
      }
      cancelledCount = reservationsToCancel.length;
    }
    
    // Also update station status if all chargers are out of service
    const allChargers = db.prepare('SELECT status FROM chargers WHERE station_id = ?').all(req.params.stationId);
    if (allChargers.every(c => c.status === 'out_of_service')) {
      db.prepare("UPDATE stations SET status = 'offline' WHERE id = ?").run(req.params.stationId);
    } else {
      db.prepare("UPDATE stations SET status = 'available' WHERE id = ?").run(req.params.stationId);
    }

    return cancelledCount;
  });

  try {
    const cancelledCount = transaction();
    const charger = db.prepare('SELECT * FROM chargers WHERE id = ?').get(req.params.chargerId);
    res.json({ charger, cancelledCount, message: `Status updated. ${cancelledCount} active reservations cancelled.` });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update charger status' });
  }
});

// POST /api/stations/:id/issues - Report a physical issue (R15)
router.post('/:id/issues', authMiddleware, (req, res) => {
  const db = getDb();
  const { charger_id, description } = req.body;
  const station_id = req.params.id;

  if (!description) {
    return res.status(400).json({ error: 'Description is required' });
  }

  try {
    const result = db.prepare(
      'INSERT INTO issue_reports (user_id, station_id, charger_id, description) VALUES (?, ?, ?, ?)'
    ).run(req.user.id, station_id, charger_id || null, description);

    res.status(201).json({ message: 'Issue reported successfully. Thank you for your feedback.', id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit issue report' });
  }
});

module.exports = router;
