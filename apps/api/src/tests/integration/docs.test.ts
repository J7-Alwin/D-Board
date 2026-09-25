import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../server.js';

describe('OpenAPI Documentation Integration Tests', () => {
  it('GET /api/docs/openapi.json should return valid OpenAPI 3.0 specification', async () => {
    const res = await request(app).get('/api/docs/openapi.json');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.openapi).toBe('3.0.3');
    expect(res.body.info.title).toBe('D-Board REST API');
    expect(res.body.paths).toBeDefined();
    expect(res.body.paths['/health']).toBeDefined();
    expect(res.body.paths['/ready']).toBeDefined();
    expect(res.body.paths['/auth/register']).toBeDefined();
    expect(res.body.paths['/auth/login']).toBeDefined();
    expect(res.body.paths['/projects']).toBeDefined();
  });

  it('GET /api/docs should return Swagger UI HTML documentation page', async () => {
    const res = await request(app).get('/api/docs');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toContain('D-Board REST API Documentation');
    expect(res.text).toContain('swagger-ui');
  });
});
