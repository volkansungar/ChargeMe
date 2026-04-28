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

// GET /api/admin/issues - Get all issue reports
router.get('/issues', (req, res) => {
  const db = getDb();
  const issues = db.prepare(`
    SELECT i.*, s.name as station_name, c.charger_label 
    FROM issue_reports i
    JOIN stations s ON i.station_id = s.id
    LEFT JOIN chargers c ON i.charger_id = c.id
    ORDER BY i.created_at DESC
  `).all();
  res.json(issues);
});

// PUT /api/admin/issues/:id/resolve - Mark issue as resolved
router.put('/issues/:id/resolve', (req, res) => {
  const db = getDb();
  db.prepare("UPDATE issue_reports SET status = 'resolved' WHERE id = ?").run(req.params.id);
  res.json({ message: 'Issue marked as resolved' });
});

// GET /api/admin/marketing - Get marketing analytics (R20)
router.get('/marketing', (req, res) => {
  const db = getDb();
  
  // Most favorited stations
  const favorites = db.prepare(`
    SELECT s.name, COUNT(f.id) as fav_count
    FROM stations s
    JOIN favorites f ON s.id = f.station_id
    GROUP BY s.id
    ORDER BY fav_count DESC
    LIMIT 5
  `).all();

  // Usage habits: sessions by time of day (morning, afternoon, evening, night)
  // Since this is SQLite, we can extract the hour from start_time
  const timeHabits = db.prepare(`
    SELECT 
      CASE 
        WHEN CAST(substr(start_time, 1, 2) AS INTEGER) >= 6 AND CAST(substr(start_time, 1, 2) AS INTEGER) < 12 THEN 'Morning (6am-12pm)'
        WHEN CAST(substr(start_time, 1, 2) AS INTEGER) >= 12 AND CAST(substr(start_time, 1, 2) AS INTEGER) < 18 THEN 'Afternoon (12pm-6pm)'
        WHEN CAST(substr(start_time, 1, 2) AS INTEGER) >= 18 AND CAST(substr(start_time, 1, 2) AS INTEGER) < 24 THEN 'Evening (6pm-12am)'
        ELSE 'Night (12am-6am)'
      END as time_of_day,
      COUNT(*) as session_count
    FROM reservations
    GROUP BY time_of_day
  `).all();

  res.json({
    topFavorites: favorites,
    timeHabits: timeHabits
  });
});

module.exports = router;
