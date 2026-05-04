import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../index';

describe('Station API Integration Tests', () => {
  it('GET /api/stations should return a list of stations with chargers', async () => {
    const res = await request(app).get('/api/stations');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('name');
      expect(res.body[0]).toHaveProperty('chargers');
      expect(Array.isArray(res.body[0].chargers)).toBe(true);
    }
  });

  it('POST /api/stations/:id/favorite should toggle favorite status', async () => {
    // We assume station 1 exists from seed data
    const res1 = await request(app).post('/api/stations/1/favorite');
    expect(res1.status).toBe(200);
    expect(res1.body).toHaveProperty('isFavorite');
    
    const res2 = await request(app).get('/api/stations/1/favorite');
    expect(res2.body.isFavorite).toBe(res1.body.isFavorite);
  });

  it('POST /api/stations/:id/issues should require a description', async () => {
    const res = await request(app)
      .post('/api/stations/1/issues')
      .send({ charger_id: 1 });
    
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/description is required/i);
  });

  it('POST /api/stations/:id/issues should successfully report an issue', async () => {
    const res = await request(app)
      .post('/api/stations/1/issues')
      .send({ description: 'Test issue report', charger_id: 1 });
    
    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/reported successfully/i);
  });
});
