import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LocalStorageProvider } from '../../storage/localStorage.provider.js';
import { S3StorageProvider } from '../../storage/s3Storage.provider.js';
import { getRedisConfig } from '../../redis/redis.client.js';

describe('Storage & Cloud Provider Adapters Integration Tests', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('Local Storage Provider', () => {
    it('should write, read, check existence, and delete files locally', async () => {
      const provider = new LocalStorageProvider();
      const testKey = `test_local_${Date.now()}.txt`;
      const testContent = Buffer.from('Local storage provider verification test payload');

      await provider.upload(testKey, testContent, 'text/plain');

      const exists = await provider.exists(testKey);
      expect(exists).toBe(true);

      const buffer = await provider.getBuffer(testKey);
      expect(buffer.toString('utf-8')).toBe(testContent.toString('utf-8'));

      await provider.delete(testKey);

      const existsAfterDelete = await provider.exists(testKey);
      expect(existsAfterDelete).toBe(false);
    });

    it('should reject path traversal attempts', async () => {
      const provider = new LocalStorageProvider();
      const maliciousKey = '../../../../etc/passwd';
      const testContent = Buffer.from('malicious payload');

      await expect(provider.upload(maliciousKey, testContent, 'text/plain')).rejects.toThrow(
        /Security violation/
      );
    });
  });

  describe('S3 / Cloudflare R2 Provider Neutrality', () => {
    it('should prioritize provider-neutral S3_* environment variables over AWS_*', () => {
      process.env.S3_BUCKET = 'provider-neutral-bucket';
      process.env.S3_ENDPOINT = 'https://accountid.r2.cloudflarestorage.com';
      process.env.S3_REGION = 'auto';
      process.env.S3_ACCESS_KEY_ID = 'neutral-key-id';
      process.env.S3_SECRET_ACCESS_KEY = 'neutral-secret-key';
      process.env.AWS_S3_BUCKET = 'legacy-aws-bucket';

      const provider = new S3StorageProvider();
      expect(provider.getBucketName()).toBe('provider-neutral-bucket');
    });

    it('should fallback cleanly to AWS_* variables for backward compatibility', () => {
      delete process.env.S3_BUCKET;
      delete process.env.S3_ENDPOINT;
      delete process.env.S3_REGION;
      delete process.env.S3_ACCESS_KEY_ID;
      delete process.env.S3_SECRET_ACCESS_KEY;

      process.env.AWS_S3_BUCKET = 'legacy-aws-bucket';
      process.env.AWS_REGION = 'us-east-1';
      process.env.AWS_ACCESS_KEY_ID = 'aws-key-id';
      process.env.AWS_SECRET_ACCESS_KEY = 'aws-secret-key';

      const provider = new S3StorageProvider();
      expect(provider.getBucketName()).toBe('legacy-aws-bucket');
    });

    it('should default to d-board-files when no bucket variable is set', () => {
      delete process.env.S3_BUCKET;
      delete process.env.AWS_S3_BUCKET;

      const provider = new S3StorageProvider();
      expect(provider.getBucketName()).toBe('d-board-files');
    });
  });

  describe('Redis / Valkey / Render Key Value Configuration Parsing', () => {
    it('should parse rediss:// URLs and configure TLS correctly', () => {
      process.env.REDIS_URL = 'rediss://default:supersecretredistoken@my-redis-host.com:6379';

      const config = getRedisConfig();
      expect(config.host).toBe('my-redis-host.com');
      expect(config.port).toBe(6379);
      expect(config.username).toBe('default');
      expect(config.password).toBe('supersecretredistoken');
      expect(config.tls).toBeDefined();
      expect(config.maxRetriesPerRequest).toBeNull(); // BullMQ requirement
    });

    it('should support standard redis:// URLs without TLS for Render internal or local dev', () => {
      process.env.REDIS_URL = 'redis://red-c1234567890abcdef:6379';
      delete process.env.REDIS_TLS;

      const config = getRedisConfig();
      expect(config.host).toBe('red-c1234567890abcdef');
      expect(config.port).toBe(6379);
      expect(config.tls).toBeUndefined();
      expect(config.maxRetriesPerRequest).toBeNull();
    });

    it('should support standard 127.0.0.1 redis:// URLs for local development', () => {
      process.env.REDIS_URL = 'redis://127.0.0.1:6379';
      delete process.env.REDIS_TLS;

      const config = getRedisConfig();
      expect(config.host).toBe('127.0.0.1');
      expect(config.port).toBe(6379);
      expect(config.tls).toBeUndefined();
    });
  });

  describe('Remote Provider Live Checks (Conditional / Optional)', () => {
    const hasLiveR2 = Boolean(
      process.env.S3_ENDPOINT &&
      process.env.S3_BUCKET &&
      process.env.S3_ACCESS_KEY_ID &&
      process.env.S3_SECRET_ACCESS_KEY &&
      !process.env.S3_ACCESS_KEY_ID.includes('placeholder')
    );

    const hasLiveRemoteRedis = Boolean(
      process.env.REDIS_URL &&
      !process.env.REDIS_URL.includes('127.0.0.1') &&
      !process.env.REDIS_URL.includes('localhost') &&
      !process.env.REDIS_URL.includes('example')
    );

    it.skipIf(!hasLiveR2)('Live Cloudflare R2: should execute bucket health check', async () => {
      const provider = new S3StorageProvider();
      const health = await provider.checkHealth();
      expect(health.status).toBe('healthy');
    });

    it.skipIf(!hasLiveRemoteRedis)('Live Remote Redis: should connect and ping', async () => {
      const { Redis } = await import('ioredis');
      const client = new Redis(process.env.REDIS_URL!, getRedisConfig());
      const res = await client.ping();
      expect(res).toBe('PONG');
      await client.quit();
    });
  });
});
