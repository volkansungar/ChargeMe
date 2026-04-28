const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'ev_charging.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
    seedData();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brand TEXT NOT NULL,
      model TEXT NOT NULL,
      battery_capacity REAL NOT NULL,
      connector_type TEXT NOT NULL CHECK(connector_type IN ('Type 2', 'CCS', 'CHAdeMO')),
      plate_number TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS stations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      address TEXT NOT NULL,
      operating_hours TEXT NOT NULL DEFAULT '06:00-23:00',
      status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available', 'occupied', 'offline')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS chargers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      station_id INTEGER NOT NULL,
      charger_label TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('AC', 'DC')),
      power_kw REAL NOT NULL,
      connector_type TEXT NOT NULL CHECK(connector_type IN ('Type 2', 'CCS', 'CHAdeMO')),
      price_per_kwh REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available', 'occupied', 'out_of_service')),
      FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL,
      charger_id INTEGER NOT NULL,
      reservation_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'confirmed' CHECK(status IN ('confirmed', 'active', 'completed', 'cancelled')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
      FOREIGN KEY (charger_id) REFERENCES chargers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reservation_id INTEGER,
      vehicle_id INTEGER NOT NULL,
      charger_id INTEGER NOT NULL,
      start_kwh REAL DEFAULT 0,
      current_kwh REAL DEFAULT 0,
      end_kwh REAL DEFAULT 0,
      consumed_kwh REAL DEFAULT 0,
      cost REAL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'charging' CHECK(status IN ('charging', 'completed')),
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      FOREIGN KEY (reservation_id) REFERENCES reservations(id),
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
      FOREIGN KEY (charger_id) REFERENCES chargers(id)
    );

    CREATE TABLE IF NOT EXISTS wallet (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      balance REAL NOT NULL DEFAULT 500.00,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      station_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS issue_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      station_id INTEGER NOT NULL,
      charger_id INTEGER,
      description TEXT NOT NULL,
      status TEXT DEFAULT 'open',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (station_id) REFERENCES stations (id),
      FOREIGN KEY (charger_id) REFERENCES chargers (id)
    );
  `);
}

function seedData() {
  // Only seed if stations table is empty
  const count = db.prepare('SELECT COUNT(*) as c FROM stations').get();
  if (count.c > 0) return;

  // Initialize wallet
  db.prepare('INSERT OR IGNORE INTO wallet (id, balance) VALUES (1, 500.00)').run();

  // Seed stations around İzmir
  const stations = [
    { name: 'Karşıyaka Charging Hub', lat: 38.4622, lng: 27.1100, address: 'Karşıyaka, Girne Blvd. No:42, İzmir', hours: '00:00-23:59' },
    { name: 'Alsancak Power Station', lat: 38.4350, lng: 27.1420, address: 'Alsancak, Kıbrıs Şehitleri Cad. No:15, İzmir', hours: '06:00-23:00' },
    { name: 'Bornova EV Point', lat: 38.4700, lng: 27.2200, address: 'Bornova, Ankara Cad. No:88, İzmir', hours: '07:00-22:00' },
    { name: 'Buca Green Charge', lat: 38.3900, lng: 27.1750, address: 'Buca, İnönü Mah. No:33, İzmir', hours: '06:00-00:00' },
    { name: 'Konak Central Hub', lat: 38.4192, lng: 27.1287, address: 'Konak, Cumhuriyet Blvd. No:7, İzmir', hours: '00:00-23:59' },
    { name: 'Bayraklı Tech Park Station', lat: 38.4550, lng: 27.1650, address: 'Bayraklı, Salhane Mah. No:21, İzmir', hours: '08:00-21:00' },
    { name: 'Çeşme Coastal Charger', lat: 38.3240, lng: 26.3030, address: 'Çeşme, Boyalık Mevkii No:5, İzmir', hours: '07:00-23:00' },
    { name: 'Ege University Campus Station', lat: 38.4580, lng: 27.2050, address: 'Bornova, Ege Üniversitesi Kampüsü, İzmir', hours: '06:00-22:00' }
  ];

  const insertStation = db.prepare(
    'INSERT INTO stations (name, lat, lng, address, operating_hours) VALUES (?, ?, ?, ?, ?)'
  );

  const insertCharger = db.prepare(
    'INSERT INTO chargers (station_id, charger_label, type, power_kw, connector_type, price_per_kwh, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  // Charger configurations per station
  const chargerConfigs = [
    // Karşıyaka Hub - large station
    [
      { label: 'AC 22kW #01', type: 'AC', power: 22, connector: 'Type 2', price: 3.5 },
      { label: 'AC 22kW #02', type: 'AC', power: 22, connector: 'Type 2', price: 3.5 },
      { label: 'DC 50kW #01', type: 'DC', power: 50, connector: 'CCS', price: 5.0 },
      { label: 'DC 50kW #02', type: 'DC', power: 50, connector: 'CHAdeMO', price: 5.0 },
      { label: 'DC 150kW #01', type: 'DC', power: 150, connector: 'CCS', price: 7.5 },
    ],
    // Alsancak - medium station
    [
      { label: 'AC 22kW #01', type: 'AC', power: 22, connector: 'Type 2', price: 3.5 },
      { label: 'DC 50kW #01', type: 'DC', power: 50, connector: 'CCS', price: 5.5 },
      { label: 'DC 50kW #02', type: 'DC', power: 50, connector: 'CHAdeMO', price: 5.5 },
    ],
    // Bornova - medium
    [
      { label: 'AC 22kW #01', type: 'AC', power: 22, connector: 'Type 2', price: 3.0 },
      { label: 'DC 50kW #01', type: 'DC', power: 50, connector: 'CCS', price: 4.5 },
      { label: 'DC 150kW #01', type: 'DC', power: 150, connector: 'CCS', price: 7.0 },
    ],
    // Buca - small
    [
      { label: 'AC 22kW #01', type: 'AC', power: 22, connector: 'Type 2', price: 3.0 },
      { label: 'DC 50kW #01', type: 'DC', power: 50, connector: 'CCS', price: 4.5, status: 'out_of_service' },
    ],
    // Konak - large
    [
      { label: 'AC 22kW #01', type: 'AC', power: 22, connector: 'Type 2', price: 4.0 },
      { label: 'AC 22kW #02', type: 'AC', power: 22, connector: 'Type 2', price: 4.0 },
      { label: 'DC 50kW #01', type: 'DC', power: 50, connector: 'CCS', price: 6.0 },
      { label: 'DC 150kW #01', type: 'DC', power: 150, connector: 'CCS', price: 8.0 },
    ],
    // Bayraklı
    [
      { label: 'AC 22kW #01', type: 'AC', power: 22, connector: 'Type 2', price: 3.5 },
      { label: 'DC 50kW #01', type: 'DC', power: 50, connector: 'CHAdeMO', price: 5.0 },
    ],
    // Çeşme - small
    [
      { label: 'AC 22kW #01', type: 'AC', power: 22, connector: 'Type 2', price: 4.0 },
      { label: 'DC 50kW #01', type: 'DC', power: 50, connector: 'CCS', price: 6.0 },
    ],
    // Ege University
    [
      { label: 'AC 22kW #01', type: 'AC', power: 22, connector: 'Type 2', price: 2.5 },
      { label: 'AC 22kW #02', type: 'AC', power: 22, connector: 'Type 2', price: 2.5 },
      { label: 'DC 50kW #01', type: 'DC', power: 50, connector: 'CCS', price: 4.0 },
    ],
  ];

  const transaction = db.transaction(() => {
    stations.forEach((station, idx) => {
      const result = insertStation.run(station.name, station.lat, station.lng, station.address, station.hours);
      const stationId = result.lastInsertRowid;
      
      chargerConfigs[idx].forEach(charger => {
        insertCharger.run(
          stationId,
          charger.label,
          charger.type,
          charger.power,
          charger.connector,
          charger.price,
          charger.status || 'available'
        );
      });
    });
  });

  transaction();
  console.log('✅ Database seeded with İzmir charging stations');
}

module.exports = { getDb };
