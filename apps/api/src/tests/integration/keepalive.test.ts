import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../server.js';
import { pingDatabase, verifyCronSecret } from '../../services/keepalive.service.js';
import env from '../../config/env.js';

describe('Supabase Keepalive & Database Retrieval Security Tests', () => {
  const originalCronSecret = env.CRON_SECRET;

  afterEach(() => {
    env.CRON_SECRET = originalCronSecret;
    delete process.env.CRON_SECRET;
  });

  describe('verifyCronSecret Security Tests', () => {
    it('returns true when no secret is configured (open development mode)', () => {
      env.CRON_SECRET = undefined;
      delete process.env.CRON_SECRET;
      expect(verifyCronSecret()).toBe(true);
      expect(verifyCronSecret('Bearer random')).toBe(true);
    });

    it('returns true when valid secret is provided via x-cron-key header', () => {
      env.CRON_SECRET = 'super-secure-cron-token-1234567890';
      expect(verifyCronSecret(undefined, 'super-secure-cron-token-1234567890')).toBe(true);
    });

    it('returns true when valid secret is provided via Bearer Authorization header', () => {
      env.CRON_SECRET = 'super-secure-cron-token-1234567890';
      expect(verifyCronSecret('Bearer super-secure-cron-token-1234567890', undefined)).toBe(true);
    });

    it('rejects missing or empty secret when CRON_SECRET is configured', () => {
      env.CRON_SECRET = 'super-secure-cron-token-1234567890';
      expect(verifyCronSecret()).toBe(false);
      expect(verifyCronSecret('')).toBe(false);
      expect(verifyCronSecret(undefined, '')).toBe(false);
    });

    it('rejects incorrect secret or mismatched length without throwing timing errors', () => {
      env.CRON_SECRET = 'super-secure-cron-token-1234567890';
      expect(verifyCronSecret('Bearer wrong-secret')).toBe(false);
      expect(verifyCronSecret(undefined, 'super-secure-cron-token-1234567899')).toBe(false);
      expect(verifyCronSecret('Bearer ' + 'a'.repeat(100))).toBe(false);
    });
  });

  describe('pingDatabase Functionality & Zero-Leakage Checks', () => {
    it('successfully queries database and returns strictly sanitized metadata', async () => {
      const result = await pingDatabase();

      expect(result.service).toBe('d-board-db-keepalive');
      expect(typeof result.timestamp).toBe('string');
      expect(['healthy', 'unhealthy']).toContain(result.status);

      // Verify that no database credentials, queries, or user rows are leaked
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain('password');
      expect(serialized).not.toContain('postgres://');
      expect(serialized).not.toContain('postgresql://');
      expect(serialized).not.toContain('SELECT');
      expect(serialized).not.toContain('User');
    });
  });

  describe('API Endpoints (GET/POST /api/cron/keepalive & /api/health/db-ping)', () => {
    it('allows keepalive request and executes DB query when authorized', async () => {
      env.CRON_SECRET = 'test-secret-key-32-chars-long-abc';

      const res = await request(app)
        .post('/api/cron/keepalive')
        .set('x-cron-key', 'test-secret-key-32-chars-long-abc');

      expect([200, 503]).toContain(res.status);
      expect(res.body.service).toBe('d-board-db-keepalive');
      expect(res.body.timestamp).toBeDefined();

      // Ensure no sensitive leakage
      const raw = JSON.stringify(res.body);
      expect(raw).not.toContain('password');
      expect(raw).not.toContain('postgres://');
      expect(raw).not.toContain('jwt');
    });

    it('rejects unauthorized request with 401 when CRON_SECRET is set', async () => {
      env.CRON_SECRET = 'test-secret-key-32-chars-long-abc';

      const res = await request(app)
        .post('/api/cron/keepalive')
        .set('x-cron-key', 'wrong-key');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Unauthorized');
      expect(res.body.service).toBe('d-board-db-keepalive');
    });

    it('supports GET /api/health/db-ping', async () => {
      env.CRON_SECRET = undefined; // open in dev

      const res = await request(app).get('/api/health/db-ping');

      expect([200, 503]).toContain(res.status);
      expect(res.body.service).toBe('d-board-db-keepalive');
      expect(res.body.timestamp).toBeDefined();
    });
  });
});

