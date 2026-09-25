import crypto from 'node:crypto';
import path from 'node:path';
import type { StorageProvider } from './storage.interface.js';
import { LocalStorageProvider } from './localStorage.provider.js';
import { S3StorageProvider } from './s3Storage.provider.js';

export class StorageService {
  private provider: StorageProvider;

  constructor(provider?: StorageProvider) {
    if (provider) {
      this.provider = provider;
    } else {
      const driver = process.env.STORAGE_DRIVER || (process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID ? 's3' : 'local');
      if (driver === 's3') {
        this.provider = new S3StorageProvider();
      } else {
        this.provider = new LocalStorageProvider();
      }
    }
  }

  getProvider(): StorageProvider {
    return this.provider;
  }

  /**
   * Generate a secure random storage key.
   * Format: projects/<projectId>/<uuid>.<ext>
   */
  generateStorageKey(projectId: string, originalName: string): { storageKey: string; extension: string } {
    const rawExt = path.extname(originalName).toLowerCase().replace(/^\./, '');
    const extension = rawExt ? rawExt.slice(0, 16) : 'bin';
    const uuid = crypto.randomUUID();
    const storageKey = `projects/${projectId}/${uuid}.${extension}`;
    return { storageKey, extension };
  }

  /**
   * Computes SHA-256 hex checksum of a buffer.
   */
  computeChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  async upload(key: string, data: Buffer, mimeType: string): Promise<void> {
    return this.provider.upload(key, data, mimeType);
  }

  async getStream(key: string) {
    return this.provider.getStream(key);
  }

  async getBuffer(key: string): Promise<Buffer> {
    return this.provider.getBuffer(key);
  }

  async delete(key: string): Promise<void> {
    return this.provider.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.provider.exists(key);
  }

  async getUrl(key: string): Promise<string | null> {
    if (this.provider.getUrl) {
      return this.provider.getUrl(key);
    }
    return null;
  }

  /**
   * Lightweight health check verifying storage provider connectivity without downloading user data.
   */
  async checkHealth(): Promise<{ status: 'healthy' | 'degraded'; driver: string; error?: string }> {
    const driver = process.env.STORAGE_DRIVER || (process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID ? 's3' : 'local');
    try {
      // Test non-destructive existence check for root namespace
      await this.provider.exists(`health-check-${Date.now()}`);
      return { status: 'healthy', driver };
    } catch (err: any) {
      return { status: 'degraded', driver, error: err.message || 'Storage unavailable' };
    }
  }
}

export const storageService = new StorageService();


