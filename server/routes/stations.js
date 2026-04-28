const express = require('express');
const router = express.Router();
const { getDb } = require('../db');

// GET /api/stations - List all stations with chargers
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

// GET /api/stations/:id - Station detail with chargers and availability
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

// GET /api/stations/:id/favorites - Check if favorited
router.get('/:id/favorite', (req, res) => {
  const db = getDb();
  const fav = db.prepare('SELECT * FROM favorites WHERE station_id = ?').get(req.params.id);
  res.json({ isFavorite: !!fav });
});

// POST /api/stations/:id/favorite - Toggle favorite
router.post('/:id/favorite', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM favorites WHERE station_id = ?').get(req.params.id);
  
  if (existing) {
    db.prepare('DELETE FROM favorites WHERE station_id = ?').run(req.params.id);
    res.json({ isFavorite: false });
  } else {
    db.prepare('INSERT INTO favorites (station_id) VALUES (?)').run(req.params.id);
    res.json({ isFavorite: true });
  }
});

// GET /api/stations/favorites/list - List favorite stations
router.get('/favorites/list', (req, res) => {
  const db = getDb();
  const favorites = db.prepare(`
    SELECT s.* FROM stations s
    JOIN favorites f ON s.id = f.station_id
    ORDER BY f.created_at DESC
  `).all();
  res.json(favorites);
});

module.exports = router;
