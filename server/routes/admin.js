const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const { requireRole } = require('../middleware/auth');

// Apply placeholder admin role check (currently a pass-through)
// When login is implemented later, this middleware will block unauthorized access
router.use(requireRole('admin'));

// GET /api/admin/stats - High level analytics
router.get('/stats', (req, res) => {
  const db = getDb();
  
  // Total Revenue
  const revenueRes = db.prepare("SELECT SUM(cost) as total FROM sessions WHERE status = 'completed'").get();
  const totalRevenue = revenueRes.total || 0;

  // Total Energy Dispensed
  const energyRes = db.prepare("SELECT SUM(consumed_kwh) as total FROM sessions WHERE status = 'completed'").get();
  const totalEnergy = energyRes.total || 0;

  // Active / Completed Sessions count
  const sessionStats = db.prepare('SELECT status, COUNT(*) as count FROM sessions GROUP BY status').all();
  let activeSessions = 0;
  let completedSessions = 0;
  sessionStats.forEach(s => {
    if (s.status === 'charging') activeSessions = s.count;
    if (s.status === 'completed') completedSessions = s.count;
  });

  // Total Users/Vehicles (mocking users with unique vehicles)
  const usersRes = db.prepare('SELECT COUNT(*) as count FROM vehicles').get();
  const totalVehicles = usersRes.count;

  res.json({
    totalRevenue,
    totalEnergy,
    activeSessions,
    completedSessions,
    totalVehicles
  });
});

// GET /api/admin/utilization - Station utilization
router.get('/utilization', (req, res) => {
  const db = getDb();
  
  // Get revenue and energy per station
  const stats = db.prepare(`
    SELECT st.id, st.name, 
           COALESCE(SUM(s.consumed_kwh), 0) as total_kwh,
           COALESCE(SUM(s.cost), 0) as total_revenue,
           COUNT(s.id) as session_count
    FROM stations st
    LEFT JOIN chargers c ON st.id = c.station_id
    LEFT JOIN sessions s ON c.id = s.charger_id AND s.status = 'completed'
    GROUP BY st.id
    ORDER BY total_revenue DESC
  `).all();

  res.json(stats);
});

module.exports = router;
