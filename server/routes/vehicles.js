const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { authMiddleware } = require('../middleware/auth');

// All vehicle routes require authentication
router.use(authMiddleware);

// GET /api/vehicles - List current user's vehicles
router.get('/', (req, res) => {
  const db = getDb();
  const vehicles = db.prepare('SELECT * FROM vehicles WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json(vehicles);
});

// GET /api/vehicles/:id - Get single vehicle (must belong to user)
router.get('/:id', (req, res) => {
  const db = getDb();
  const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
  res.json(vehicle);
});

// POST /api/vehicles - Register a new vehicle for current user
router.post('/', (req, res) => {
  const db = getDb();
  const { brand, model, battery_capacity, connector_type, plate_number } = req.body;

  // Validation
  if (!brand || !model || !battery_capacity || !connector_type || !plate_number) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const validConnectors = ['Type 2', 'CCS', 'CHAdeMO'];
  if (!validConnectors.includes(connector_type)) {
    return res.status(400).json({ error: `Connector type must be one of: ${validConnectors.join(', ')}` });
  }

  if (battery_capacity <= 0 || battery_capacity > 300) {
    return res.status(400).json({ error: 'Battery capacity must be between 1 and 300 kWh' });
  }

  // Check plate uniqueness
  const existing = db.prepare('SELECT id FROM vehicles WHERE plate_number = ?').get(plate_number.toUpperCase());
  if (existing) {
    return res.status(409).json({ error: 'A vehicle with this license plate is already registered' });
  }

  try {
    const result = db.prepare(
      'INSERT INTO vehicles (user_id, brand, model, battery_capacity, connector_type, plate_number) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(req.user.id, brand.trim(), model.trim(), battery_capacity, connector_type, plate_number.toUpperCase().trim());

    const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(vehicle);
  } catch (err) {
    res.status(500).json({ error: 'Failed to register vehicle' });
  }
});

// PUT /api/vehicles/:id - Update a vehicle (must belong to user)
router.put('/:id', (req, res) => {
  const db = getDb();
  const { brand, model, battery_capacity, connector_type, plate_number } = req.body;

  const existing = db.prepare('SELECT * FROM vehicles WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Vehicle not found' });

  // Check plate uniqueness if plate changed
  if (plate_number && plate_number.toUpperCase() !== existing.plate_number) {
    const dupe = db.prepare('SELECT id FROM vehicles WHERE plate_number = ? AND id != ?')
      .get(plate_number.toUpperCase(), req.params.id);
    if (dupe) {
      return res.status(409).json({ error: 'A vehicle with this license plate is already registered' });
    }
  }

  try {
    db.prepare(`
      UPDATE vehicles SET 
        brand = COALESCE(?, brand),
        model = COALESCE(?, model),
        battery_capacity = COALESCE(?, battery_capacity),
        connector_type = COALESCE(?, connector_type),
        plate_number = COALESCE(?, plate_number)
      WHERE id = ? AND user_id = ?
    `).run(
      brand?.trim(), model?.trim(), battery_capacity, connector_type,
      plate_number?.toUpperCase().trim(), req.params.id, req.user.id
    );

    const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(req.params.id);
    res.json(vehicle);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update vehicle' });
  }
});

// DELETE /api/vehicles/:id - Delete a vehicle (must belong to user)
router.delete('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM vehicles WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Vehicle not found' });

  db.prepare('DELETE FROM vehicles WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ message: 'Vehicle deleted successfully' });
});

module.exports = router;
