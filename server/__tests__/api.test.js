import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../index';

/**
 * SERVER API — UNIT & COMPONENT TESTS
 * 
 * Following testing1.md / testing2.md methodology:
 * - Unit tests for individual endpoints (isolation)
 * - Interface tests (parameter validation, error handling)
 * - Partition testing (valid/invalid equivalence classes)
 * - Guideline-based testing (boundary values, edge cases)
 */

let adminToken;
let driverToken;
let newUserToken;

// ═══════════════════════════════════════════
// Test Setup — Obtain auth tokens
// ═══════════════════════════════════════════
beforeAll(async () => {
  // Login as admin (seeded)
  const adminRes = await request(app).post('/api/auth/login').send({
    username: 'admin', password: 'admin123'
  });
  adminToken = adminRes.body.token;

  // Login as driver (seeded)
  const driverRes = await request(app).post('/api/auth/login').send({
    username: 'driver', password: 'driver123'
  });
  driverToken = driverRes.body.token;
});

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

// ═══════════════════════════════════════════
// 1. AUTH — Unit Tests
// ═══════════════════════════════════════════
describe('Auth API — Unit Tests', () => {

  // ── Registration ──
  describe('POST /api/auth/register', () => {
    it('should register a new user with valid data', async () => {
      const ts = Date.now();
      const res = await request(app).post('/api/auth/register').send({
        username: `testuser_${ts}`,
        email: `test_${ts}@example.com`,
        password: 'secure123',
        confirmPassword: 'secure123'
      });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.username).toBe(`testuser_${ts}`);
      expect(res.body.user.role).toBe('user');
      expect(res.body.user.balance).toBe(500);
      newUserToken = res.body.token;
    });

    // Partition: missing fields
    it('should reject registration with missing username', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'x@x.com', password: '123456'
      });
      expect(res.status).toBe(400);
    });

    it('should reject registration with missing email', async () => {
      const res = await request(app).post('/api/auth/register').send({
        username: 'nomail', password: '123456'
      });
      expect(res.status).toBe(400);
    });

    it('should reject registration with missing password', async () => {
      const res = await request(app).post('/api/auth/register').send({
        username: 'nopass', email: 'nopass@x.com'
      });
      expect(res.status).toBe(400);
    });

    // Partition: invalid formats
    it('should reject username shorter than 3 chars', async () => {
      const res = await request(app).post('/api/auth/register').send({
        username: 'ab', email: 'short@x.com', password: '123456'
      });
      expect(res.status).toBe(400);
    });

    it('should reject username with special characters', async () => {
      const res = await request(app).post('/api/auth/register').send({
        username: 'bad@user!', email: 'spec@x.com', password: '123456'
      });
      expect(res.status).toBe(400);
    });

    it('should reject invalid email format', async () => {
      const res = await request(app).post('/api/auth/register').send({
        username: 'validu', email: 'not-an-email', password: '123456'
      });
      expect(res.status).toBe(400);
    });

    // Boundary: password length
    it('should reject password shorter than 6 chars', async () => {
      const res = await request(app).post('/api/auth/register').send({
        username: 'shortpw', email: 'sp@x.com', password: '12345'
      });
      expect(res.status).toBe(400);
    });

    it('should accept password exactly 6 chars', async () => {
      const ts = Date.now();
      const res = await request(app).post('/api/auth/register').send({
        username: `exactpw_${ts}`, email: `ep_${ts}@x.com`, password: '123456'
      });
      expect(res.status).toBe(201);
    });

    // Partition: password mismatch
    it('should reject mismatched passwords', async () => {
      const res = await request(app).post('/api/auth/register').send({
        username: 'mismatch', email: 'mm@x.com',
        password: '123456', confirmPassword: '654321'
      });
      expect(res.status).toBe(400);
    });

    // Uniqueness constraints
    it('should reject duplicate username', async () => {
      const res = await request(app).post('/api/auth/register').send({
        username: 'admin', email: 'new@x.com', password: '123456'
      });
      expect(res.status).toBe(409);
    });

    it('should reject duplicate email', async () => {
      const res = await request(app).post('/api/auth/register').send({
        username: 'uniqueuser', email: 'admin@chargeme.com', password: '123456'
      });
      expect(res.status).toBe(409);
    });
  });

  // ── Login ──
  describe('POST /api/auth/login', () => {
    it('should login with correct credentials', async () => {
      const res = await request(app).post('/api/auth/login').send({
        username: 'admin', password: 'admin123'
      });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.role).toBe('admin');
    });

    it('should login with email instead of username', async () => {
      const res = await request(app).post('/api/auth/login').send({
        username: 'admin@chargeme.com', password: 'admin123'
      });
      expect(res.status).toBe(200);
      expect(res.body.user.username).toBe('admin');
    });

    it('should reject wrong password', async () => {
      const res = await request(app).post('/api/auth/login').send({
        username: 'admin', password: 'wrongpass'
      });
      expect(res.status).toBe(401);
    });

    it('should reject non-existent user', async () => {
      const res = await request(app).post('/api/auth/login').send({
        username: 'ghost', password: '123456'
      });
      expect(res.status).toBe(401);
    });

    it('should reject empty credentials', async () => {
      const res = await request(app).post('/api/auth/login').send({});
      expect(res.status).toBe(400);
    });
  });

  // ── Token validation ──
  describe('GET /api/auth/me', () => {
    it('should return user profile with valid token', async () => {
      const res = await request(app).get('/api/auth/me')
        .set(authHeader(driverToken));
      expect(res.status).toBe(200);
      expect(res.body.username).toBe('driver');
      expect(res.body).not.toHaveProperty('password_hash');
    });

    it('should reject request without token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('should reject request with invalid token', async () => {
      const res = await request(app).get('/api/auth/me')
        .set({ Authorization: 'Bearer invalidtoken123' });
      expect(res.status).toBe(401);
    });
  });
});

// ═══════════════════════════════════════════
// 2. STATIONS — Public & Authenticated
// ═══════════════════════════════════════════
describe('Stations API', () => {
  it('GET /api/stations should return stations publicly (no auth)', async () => {
    const res = await request(app).get('/api/stations');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('chargers');
  });

  it('GET /api/stations/:id should return station detail with chargers', async () => {
    const res = await request(app).get('/api/stations/1');
    expect(res.status).toBe(200);
    expect(res.body.name).toBeDefined();
    expect(Array.isArray(res.body.chargers)).toBe(true);
    expect(res.body.chargers[0]).toHaveProperty('power_kw');
    expect(res.body.chargers[0]).toHaveProperty('price_per_kwh');
  });

  it('GET /api/stations/999 should return 404 for non-existent station', async () => {
    const res = await request(app).get('/api/stations/999');
    expect(res.status).toBe(404);
  });

  // Favorites require auth
  describe('Favorites (authenticated)', () => {
    it('POST toggle favorite should work for logged-in user', async () => {
      const res = await request(app).post('/api/stations/1/favorite')
        .set(authHeader(driverToken));
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('isFavorite');
    });

    it('GET favorite status should reflect toggle', async () => {
      const res = await request(app).get('/api/stations/1/favorite')
        .set(authHeader(driverToken));
      expect(res.status).toBe(200);
      expect(typeof res.body.isFavorite).toBe('boolean');
    });

    it('POST favorite without auth should return 401', async () => {
      const res = await request(app).post('/api/stations/1/favorite');
      expect(res.status).toBe(401);
    });
  });
});

// ═══════════════════════════════════════════
// 3. VEHICLES — Per-user isolation
// ═══════════════════════════════════════════
describe('Vehicles API', () => {
  let vehicleId;

  it('should reject unauthenticated requests', async () => {
    const res = await request(app).get('/api/vehicles');
    expect(res.status).toBe(401);
  });

  it('should register a vehicle for the driver', async () => {
    const res = await request(app).post('/api/vehicles')
      .set(authHeader(driverToken))
      .send({
        brand: 'Tesla', model: 'Model 3',
        battery_capacity: 75, connector_type: 'CCS',
        plate_number: 'TEST-001'
      });
    expect(res.status).toBe(201);
    expect(res.body.brand).toBe('Tesla');
    vehicleId = res.body.id;
  });

  it('should list only the driver\'s vehicles', async () => {
    const res = await request(app).get('/api/vehicles')
      .set(authHeader(driverToken));
    expect(res.status).toBe(200);
    expect(res.body.every(v => v.user_id !== undefined)).toBe(true);
  });

  // Partition: invalid connector type
  it('should reject invalid connector type', async () => {
    const res = await request(app).post('/api/vehicles')
      .set(authHeader(driverToken))
      .send({
        brand: 'BMW', model: 'i3', battery_capacity: 42,
        connector_type: 'InvalidType', plate_number: 'BAD-001'
      });
    expect(res.status).toBe(400);
  });

  // Boundary: battery capacity
  it('should reject battery_capacity = 0', async () => {
    const res = await request(app).post('/api/vehicles')
      .set(authHeader(driverToken))
      .send({
        brand: 'BMW', model: 'i3', battery_capacity: 0,
        connector_type: 'CCS', plate_number: 'ZERO-001'
      });
    expect(res.status).toBe(400);
  });

  it('should reject battery_capacity > 300', async () => {
    const res = await request(app).post('/api/vehicles')
      .set(authHeader(driverToken))
      .send({
        brand: 'BMW', model: 'i3', battery_capacity: 301,
        connector_type: 'CCS', plate_number: 'BIG-001'
      });
    expect(res.status).toBe(400);
  });

  // R43: Unique plate number
  it('should reject duplicate plate number', async () => {
    const res = await request(app).post('/api/vehicles')
      .set(authHeader(driverToken))
      .send({
        brand: 'Audi', model: 'e-tron', battery_capacity: 95,
        connector_type: 'CCS', plate_number: 'TEST-001'
      });
    expect(res.status).toBe(409);
  });

  // Missing fields
  it('should reject vehicle with missing brand', async () => {
    const res = await request(app).post('/api/vehicles')
      .set(authHeader(driverToken))
      .send({
        model: 'i3', battery_capacity: 42,
        connector_type: 'CCS', plate_number: 'MISS-001'
      });
    expect(res.status).toBe(400);
  });

  // User isolation
  it('admin should NOT see driver\'s vehicles', async () => {
    const res = await request(app).get('/api/vehicles')
      .set(authHeader(adminToken));
    const hasDriverVehicle = res.body.some(v => v.plate_number === 'TEST-001');
    expect(hasDriverVehicle).toBe(false);
  });

  it('should delete own vehicle', async () => {
    const res = await request(app).delete(`/api/vehicles/${vehicleId}`)
      .set(authHeader(driverToken));
    expect(res.status).toBe(200);
  });
});

// ═══════════════════════════════════════════
// 4. WALLET — Per-user balance
// ═══════════════════════════════════════════
describe('Wallet API', () => {
  it('should return authenticated user\'s balance', async () => {
    const res = await request(app).get('/api/wallet')
      .set(authHeader(driverToken));
    expect(res.status).toBe(200);
    expect(typeof res.body.balance).toBe('number');
  });

  it('should reject unauthenticated wallet access', async () => {
    const res = await request(app).get('/api/wallet');
    expect(res.status).toBe(401);
  });

  it('should top up wallet with valid amount', async () => {
    const before = await request(app).get('/api/wallet').set(authHeader(driverToken));
    const res = await request(app).post('/api/wallet/topup')
      .set(authHeader(driverToken)).send({ amount: 100 });
    expect(res.status).toBe(200);
    expect(res.body.balance).toBeCloseTo(before.body.balance + 100, 1);
  });

  // Partition: invalid amounts
  it('should reject negative top-up amount', async () => {
    const res = await request(app).post('/api/wallet/topup')
      .set(authHeader(driverToken)).send({ amount: -50 });
    expect(res.status).toBe(400);
  });

  it('should reject zero amount', async () => {
    const res = await request(app).post('/api/wallet/topup')
      .set(authHeader(driverToken)).send({ amount: 0 });
    expect(res.status).toBe(400);
  });

  // Boundary: max top-up
  it('should reject amount exceeding 10000 TL', async () => {
    const res = await request(app).post('/api/wallet/topup')
      .set(authHeader(driverToken)).send({ amount: 10001 });
    expect(res.status).toBe(400);
  });

  // User isolation
  it('driver and admin should have separate balances', async () => {
    const driverWallet = await request(app).get('/api/wallet').set(authHeader(driverToken));
    const adminWallet = await request(app).get('/api/wallet').set(authHeader(adminToken));
    // Admin seeded with 99999, driver with 500 (+ top-ups)
    expect(adminWallet.body.balance).not.toBe(driverWallet.body.balance);
  });
});

// ═══════════════════════════════════════════
// 5. ADMIN — Role enforcement
// ═══════════════════════════════════════════
describe('Admin API — Access Control', () => {
  it('admin should access /api/admin/stats', async () => {
    const res = await request(app).get('/api/admin/stats')
      .set(authHeader(adminToken));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalRevenue');
    expect(res.body).toHaveProperty('totalUsers');
  });

  it('driver should be DENIED /api/admin/stats (403)', async () => {
    const res = await request(app).get('/api/admin/stats')
      .set(authHeader(driverToken));
    expect(res.status).toBe(403);
  });

  it('unauthenticated should be DENIED /api/admin/stats (401)', async () => {
    const res = await request(app).get('/api/admin/stats');
    expect(res.status).toBe(401);
  });

  it('admin should list all users', async () => {
    const res = await request(app).get('/api/admin/users')
      .set(authHeader(adminToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    // Should not expose password hashes
    expect(res.body[0]).not.toHaveProperty('password_hash');
  });

  it('driver should be DENIED user listing (403)', async () => {
    const res = await request(app).get('/api/admin/users')
      .set(authHeader(driverToken));
    expect(res.status).toBe(403);
  });

  it('admin should access utilization data', async () => {
    const res = await request(app).get('/api/admin/utilization')
      .set(authHeader(adminToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('admin should access marketing analytics', async () => {
    const res = await request(app).get('/api/admin/marketing')
      .set(authHeader(adminToken));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('topFavorites');
    expect(res.body).toHaveProperty('timeHabits');
  });

  it('admin should access issues list', async () => {
    const res = await request(app).get('/api/admin/issues')
      .set(authHeader(adminToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ═══════════════════════════════════════════
// 6. ISSUE REPORTING — Interface Tests
// ═══════════════════════════════════════════
describe('Issue Reporting', () => {
  it('should require description (validation)', async () => {
    const res = await request(app).post('/api/stations/1/issues')
      .set(authHeader(driverToken)).send({ charger_id: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/description/i);
  });

  it('should successfully report with valid data', async () => {
    const res = await request(app).post('/api/stations/1/issues')
      .set(authHeader(driverToken))
      .send({ description: 'Connector damaged', charger_id: 1 });
    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/reported/i);
  });

  it('should reject unauthenticated issue report', async () => {
    const res = await request(app).post('/api/stations/1/issues')
      .send({ description: 'Anonymous report' });
    expect(res.status).toBe(401);
  });
});
