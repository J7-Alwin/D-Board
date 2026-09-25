import fs from 'node:fs';
import path from 'node:path';
import type { Readable } from 'node:stream';
import type { StorageProvider } from './storage.interface.js';

export class LocalStorageProvider implements StorageProvider {
  private basePath: string;

  constructor(basePath?: string) {
    // If not specified, default to <workspace>/uploads_storage
    const defaultPath = path.resolve(process.cwd(), '..', '..', 'uploads_storage');
    this.basePath = path.resolve(basePath || process.env.STORAGE_LOCAL_PATH || defaultPath);

    // Ensure base directory exists synchronously on init
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
    }
  }

  /**
   * Resolves storage key to absolute safe filesystem path.
   * Throws if path traversal is attempted.
   */
  private resolveSafePath(key: string): string {
    // Normalize path separators to forward slash, strip leading slashes
    const sanitizedKey = key.replace(/\\/g, '/').replace(/^\/+/, '');
    const resolvedPath = path.resolve(this.basePath, sanitizedKey);

    // Safety check: ensure target path is within base storage directory
    if (!resolvedPath.startsWith(this.basePath)) {
      throw new Error('Security violation: Storage key attempts path traversal');
    }

    return resolvedPath;
  }

  async upload(key: string, data: Buffer | Uint8Array, _mimeType: string): Promise<void> {
    const filePath = this.resolveSafePath(key);
    const parentDir = path.dirname(filePath);

    await fs.promises.mkdir(parentDir, { recursive: true });
    await fs.promises.writeFile(filePath, Buffer.from(data));
  }

  async uploadFile(key: string, sourceFilePath: string, _mimeType: string): Promise<void> {
    const targetPath = this.resolveSafePath(key);
    const parentDir = path.dirname(targetPath);

    await fs.promises.mkdir(parentDir, { recursive: true });
    await fs.promises.copyFile(sourceFilePath, targetPath);
  }

  async getStream(key: string): Promise<Readable> {
    const filePath = this.resolveSafePath(key);
    const exists = await this.exists(key);
    if (!exists) {
      throw new Error(`Storage object not found: ${key}`);
    }
    return fs.createReadStream(filePath);
  }

  async getBuffer(key: string): Promise<Buffer> {
    const filePath = this.resolveSafePath(key);
    return await fs.promises.readFile(filePath);
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolveSafePath(key);
    try {
      await fs.promises.unlink(filePath);
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }
  }

  async exists(key: string): Promise<boolean> {
    const filePath = this.resolveSafePath(key);
    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }
}
