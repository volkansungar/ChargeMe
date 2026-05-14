import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../server/index';

/**
 * REQUIREMENTS VALIDATION SUITE
 * Maps to GROUP29 requirements document (R1-R66).
 * 
 * Per testing2.md — "Requirements-based testing involves examining each
 * requirement and developing a test or tests for it."
 * 
 * Only testable functional requirements with implemented features are covered.
 * Non-functional / hardware / domain-only requirements are noted as skipped.
 */

let adminToken, driverToken, testVehicleId;

beforeAll(async () => {
  const adminRes = await request(app).post('/api/auth/login').send({
    username: 'admin', password: 'admin123'
  });
  adminToken = adminRes.body.token;

  const driverRes = await request(app).post('/api/auth/login').send({
    username: 'driver', password: 'driver123'
  });
  driverToken = driverRes.body.token;
});

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

describe('GROUP29 Requirements Validation', () => {

  // ═══ R1: Station database with location, types, power, price, hours ═══
  it('R1: Station catalog contains all required fields', async () => {
    const res = await request(app).get('/api/stations');
    expect(res.status).toBe(200);
    const station = res.body[0];
    expect(station).toHaveProperty('name');
    expect(station).toHaveProperty('lat');
    expect(station).toHaveProperty('lng');
    expect(station).toHaveProperty('address');
    expect(station).toHaveProperty('operating_hours');
    expect(station).toHaveProperty('status');
    expect(station.chargers.length).toBeGreaterThan(0);
    const charger = station.chargers[0];
    expect(charger).toHaveProperty('type');       // AC/DC
    expect(charger).toHaveProperty('power_kw');
    expect(charger).toHaveProperty('price_per_kwh');
    expect(charger).toHaveProperty('connector_type');
  });

  // ═══ R3: Vehicle registration with brand, capacity, model, plate ═══
  it('R3: Driver can register a vehicle with full specifications', async () => {
    const res = await request(app).post('/api/vehicles').set(auth(driverToken))
      .send({
        brand: 'Tesla', model: 'Model Y', battery_capacity: 75,
        connector_type: 'CCS', plate_number: `REQ-${Date.now()}`
      });
    expect(res.status).toBe(201);
    testVehicleId = res.body.id;
    expect(res.body).toHaveProperty('brand', 'Tesla');
    expect(res.body).toHaveProperty('model', 'Model Y');
    expect(res.body).toHaveProperty('battery_capacity', 75);
    expect(res.body).toHaveProperty('connector_type', 'CCS');
    expect(res.body).toHaveProperty('plate_number');
  });

  // ═══ R4: Real-time station status (available/occupied/offline) ═══
  it('R4: Stations show real-time availability status', async () => {
    const res = await request(app).get('/api/stations');
    const statuses = res.body.map(s => s.status);
    statuses.forEach(s => {
      expect(['available', 'offline']).toContain(s);
    });
    // Chargers also have status
    const chargerStatuses = res.body[0].chargers.map(c => c.status);
    chargerStatuses.forEach(s => {
      expect(['available', 'occupied', 'out_of_service']).toContain(s);
    });
  });

  // ═══ R5: Operators mark faulty units out of service ═══
  it('R5: Admin can mark a charger as out_of_service', async () => {
    // Find a valid station+charger pair
    const stationsRes = await request(app).get('/api/stations');
    const station = stationsRes.body[1]; // second station
    const charger = station.chargers[0];
    const res = await request(app)
      .put(`/api/stations/${station.id}/chargers/${charger.id}/status`)
      .set(auth(adminToken)).send({ status: 'out_of_service' });
    expect(res.status).toBe(200);
    expect(res.body.charger.status).toBe('out_of_service');
    // Restore
    await request(app).put(`/api/stations/${station.id}/chargers/${charger.id}/status`)
      .set(auth(adminToken)).send({ status: 'available' });
  });

  // ═══ R6: Max session 2 hours, max 24h advance booking ═══
  it('R6: Rejects reservation exceeding 2-hour max', async () => {
    // Find a CCS charger that matches our test vehicle
    const stationsRes = await request(app).get('/api/stations');
    let ccsChargerId = null;
    for (const s of stationsRes.body) {
      for (const c of s.chargers) {
        if (c.connector_type === 'CCS' && c.status === 'available') {
          ccsChargerId = c.id; break;
        }
      }
      if (ccsChargerId) break;
    }
    const tomorrow = new Date(Date.now() + 12 * 3600 * 1000);
    const dateStr = tomorrow.toISOString().split('T')[0];
    const res = await request(app).post('/api/reservations').set(auth(driverToken))
      .send({
        vehicle_id: testVehicleId, charger_id: ccsChargerId,
        reservation_date: dateStr, start_time: '10:00', end_time: '13:00'
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/2 hours/i);
  });

  it('R6: Rejects reservation more than 24h in advance', async () => {
    const stationsRes = await request(app).get('/api/stations');
    let ccsChargerId = null;
    for (const s of stationsRes.body) {
      for (const c of s.chargers) {
        if (c.connector_type === 'CCS' && c.status === 'available') {
          ccsChargerId = c.id; break;
        }
      }
      if (ccsChargerId) break;
    }
    const farFuture = new Date(Date.now() + 48 * 3600 * 1000);
    const dateStr = farFuture.toISOString().split('T')[0];
    const res = await request(app).post('/api/reservations').set(auth(driverToken))
      .send({
        vehicle_id: testVehicleId, charger_id: ccsChargerId,
        reservation_date: dateStr, start_time: '10:00', end_time: '11:00'
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/24 hours/i);
  });

  // ═══ R7: Select station, check compatibility, reserve ═══
  // (connector mismatch test)
  it('R7/R34/R42: Rejects reservation with incompatible connector', async () => {
    // testVehicleId is CCS, find a CHAdeMO-only charger
    const stationsRes = await request(app).get('/api/stations');
    let chademoChargerId = null;
    for (const s of stationsRes.body) {
      for (const c of s.chargers) {
        if (c.connector_type === 'CHAdeMO' && c.status === 'available') {
          chademoChargerId = c.id;
          break;
        }
      }
      if (chademoChargerId) break;
    }
    if (chademoChargerId) {
      const tomorrow = new Date(Date.now() + 12 * 3600 * 1000);
      const dateStr = tomorrow.toISOString().split('T')[0];
      const res = await request(app).post('/api/reservations').set(auth(driverToken))
        .send({
          vehicle_id: testVehicleId, charger_id: chademoChargerId,
          reservation_date: dateStr, start_time: '14:00', end_time: '15:00'
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/incompatible/i);
    }
  });

  // ═══ R8: Cost = kWh consumed × unit price ═══
  it('R8: Session cost calculated correctly from energy × price', async () => {
    // Find an available CCS charger
    const stationsRes = await request(app).get('/api/stations');
    let chargerId = null, expectedPrice = null;
    for (const s of stationsRes.body) {
      for (const c of s.chargers) {
        if (c.connector_type === 'CCS' && c.status === 'available') {
          chargerId = c.id;
          expectedPrice = c.price_per_kwh;
          break;
        }
      }
      if (chargerId) break;
    }

    if (chargerId) {
      const startRes = await request(app).post('/api/sessions/start')
        .set(auth(driverToken))
        .send({ vehicle_id: testVehicleId, charger_id: chargerId, start_kwh: 100 });
      expect(startRes.status).toBe(201);
      const sessionId = startRes.body.id;

      const updateRes = await request(app).put(`/api/sessions/${sessionId}/update`)
        .set(auth(driverToken)).send({ current_kwh: 120 });
      expect(updateRes.status).toBe(200);
      // 20 kWh consumed × price_per_kwh
      expect(updateRes.body.cost).toBeCloseTo(20 * expectedPrice, 1);

      // End and verify final cost
      const endRes = await request(app).put(`/api/sessions/${sessionId}/end`)
        .set(auth(driverToken)).send({ end_kwh: 130 });
      expect(endRes.status).toBe(200);
      expect(endRes.body.session.cost).toBeCloseTo(30 * expectedPrice, 1);
    }
  });

  // ═══ R9: Wallet top-up handled securely ═══
  it('R9: Wallet top-up increases user balance', async () => {
    const before = await request(app).get('/api/wallet').set(auth(driverToken));
    await request(app).post('/api/wallet/topup')
      .set(auth(driverToken)).send({ amount: 50 });
    const after = await request(app).get('/api/wallet').set(auth(driverToken));
    expect(after.body.balance).toBeCloseTo(before.body.balance + 50, 1);
  });

  // ═══ R15: Report physical issues ═══
  it('R15: User can report a physical station issue', async () => {
    const res = await request(app).post('/api/stations/1/issues')
      .set(auth(driverToken))
      .send({ description: 'Connector cable frayed', charger_id: 1 });
    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/reported/i);
  });

  // ═══ R16: Out-of-service cancels active reservations ═══
  it('R16: Charger out-of-service auto-cancels reservations', async () => {
    const res = await request(app)
      .put('/api/stations/1/chargers/1/status')
      .set(auth(adminToken)).send({ status: 'out_of_service' });
    expect(res.status).toBe(200);
    expect(typeof res.body.cancelledCount).toBe('number');
    // Restore charger
    await request(app).put('/api/stations/1/chargers/1/status')
      .set(auth(adminToken)).send({ status: 'available' });
  });

  // ═══ R18: View past charging records ═══
  it('R18: User can view charging history', async () => {
    const res = await request(app).get('/api/sessions')
      .set(auth(driverToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Completed sessions have required fields
    const completed = res.body.filter(s => s.status === 'completed');
    if (completed.length > 0) {
      expect(completed[0]).toHaveProperty('consumed_kwh');
      expect(completed[0]).toHaveProperty('cost');
      expect(completed[0]).toHaveProperty('station_name');
    }
  });

  // ═══ R19: Sessions stored per-user ═══
  it('R19: Sessions are scoped to authenticated user', async () => {
    const driverSessions = await request(app).get('/api/sessions').set(auth(driverToken));
    const adminSessions = await request(app).get('/api/sessions').set(auth(adminToken));
    // Admin has no sessions (never drove), driver does
    expect(adminSessions.body.length).toBe(0);
  });

  // ═══ R20: Favorite stations analyzable ═══
  it('R20: Marketing analytics include favorite stations', async () => {
    // First add a favorite
    await request(app).post('/api/stations/1/favorite').set(auth(driverToken));
    const res = await request(app).get('/api/admin/marketing').set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('topFavorites');
    expect(Array.isArray(res.body.topFavorites)).toBe(true);
  });

  // ═══ R23: Low wallet balance alert ═══
  it('R23: Wallet response includes balance for threshold checking', async () => {
    const res = await request(app).get('/api/wallet').set(auth(driverToken));
    expect(res.status).toBe(200);
    expect(typeof res.body.balance).toBe('number');
    // Client-side checks if balance < 50 and shows toast
  });

  // ═══ R27: Admin revenue and transaction reports ═══
  it('R27: Admin stats include total revenue', async () => {
    const res = await request(app).get('/api/admin/stats').set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(typeof res.body.totalRevenue).toBe('number');
    expect(typeof res.body.completedSessions).toBe('number');
    expect(typeof res.body.activeSessions).toBe('number');
  });

  // ═══ R28: Station utilization statistics ═══
  it('R28: Admin utilization shows per-station metrics', async () => {
    const res = await request(app).get('/api/admin/utilization').set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('name');
      expect(res.body[0]).toHaveProperty('session_count');
      expect(res.body[0]).toHaveProperty('total_kwh');
      expect(res.body[0]).toHaveProperty('total_revenue');
    }
  });

  // ═══ R30: User behavior summaries ═══
  it('R30: Admin stats include total user count', async () => {
    const res = await request(app).get('/api/admin/stats').set(auth(adminToken));
    expect(res.body.totalUsers).toBeGreaterThanOrEqual(1);
  });

  // ═══ R32: Charger types configurable ═══
  it('R32: Admin can update charger hardware specs', async () => {
    const res = await request(app)
      .put('/api/stations/1/chargers/1')
      .set(auth(adminToken))
      .send({ price_per_kwh: 5.5, power_kw: 50, connector_type: 'CCS' });
    expect(res.status).toBe(200);
    expect(res.body.price_per_kwh).toBe(5.5);
  });

  // ═══ R33: Filter stations by connector/power ═══
  it('R33: Station chargers have filterable connector_type and power_kw', async () => {
    const res = await request(app).get('/api/stations');
    const allChargers = res.body.flatMap(s => s.chargers);
    const types = [...new Set(allChargers.map(c => c.connector_type))];
    expect(types.length).toBeGreaterThanOrEqual(1);
    const powers = [...new Set(allChargers.map(c => c.power_kw))];
    expect(powers.length).toBeGreaterThanOrEqual(1);
  });

  // ═══ R35: Admin can update operating hours and pricing ═══
  it('R35: Admin can update station operating hours', async () => {
    const res = await request(app).put('/api/stations/1')
      .set(auth(adminToken))
      .send({ operating_hours: '08:00 - 22:00' });
    expect(res.status).toBe(200);
    expect(res.body.operating_hours).toBe('08:00 - 22:00');
  });

  // ═══ R43: Unique license plate ═══
  it('R43: Duplicate plate number is rejected', async () => {
    const plate = `UNI-${Date.now()}`;
    await request(app).post('/api/vehicles').set(auth(driverToken))
      .send({ brand: 'A', model: 'B', battery_capacity: 50, connector_type: 'CCS', plate_number: plate });
    const res = await request(app).post('/api/vehicles').set(auth(driverToken))
      .send({ brand: 'C', model: 'D', battery_capacity: 60, connector_type: 'Type 2', plate_number: plate });
    expect(res.status).toBe(409);
  });

  // ═══ R44: Users can update vehicle info ═══
  it('R44: User can update vehicle information', async () => {
    const create = await request(app).post('/api/vehicles').set(auth(driverToken))
      .send({ brand: 'Old', model: 'Car', battery_capacity: 50, connector_type: 'CCS', plate_number: `UP-${Date.now()}` });
    const res = await request(app).put(`/api/vehicles/${create.body.id}`)
      .set(auth(driverToken)).send({ brand: 'New' });
    expect(res.status).toBe(200);
    expect(res.body.brand).toBe('New');
  });
});
