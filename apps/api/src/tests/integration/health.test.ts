import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../server.js';

describe('Health & Readiness Probes Integration Tests', () => {
  it('GET /api/health should return 200 with liveness status', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('d-board-api');
    expect(typeof res.body.uptimeSeconds).toBe('number');
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('GET /api/ready should return system readiness checks without leaking secrets', async () => {
    const res = await request(app).get('/api/ready');

    expect([200, 503]).toContain(res.status);
    expect(res.body.checks).toBeDefined();
    expect(res.body.checks.database).toBeDefined();
    expect(res.body.checks.storage).toBeDefined();

    // Verify zero secret connection string leakage in readiness output
    const jsonStr = JSON.stringify(res.body);
    expect(jsonStr).not.toContain('postgres://');
    expect(jsonStr).not.toContain('postgresql://');
    expect(jsonStr).not.toContain('password');
  });
});
