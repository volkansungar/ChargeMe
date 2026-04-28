require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
getDb();

// API Routes
app.use('/api/vehicles', require('./routes/vehicles'));
app.use('/api/stations', require('./routes/stations'));
app.use('/api/reservations', require('./routes/reservations'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/admin', require('./routes/admin'));

// Serve Google Maps API key to frontend (without exposing in client code)
app.get('/api/config', (req, res) => {
  res.json({
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || ''
  });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`⚡ EV Charging Server running on http://localhost:${PORT}`);
});
