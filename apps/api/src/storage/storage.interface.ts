import type { Readable } from 'node:stream';

export interface StorageProvider {
  /**
   * Upload binary data directly to object storage.
   */
  upload(key: string, data: Buffer | Uint8Array, mimeType: string): Promise<void>;

  /**
   * Get a readable stream for the object.
   */
  getStream(key: string): Promise<Readable>;

  /**
   * Get full buffer for the object.
   */
  getBuffer(key: string): Promise<Buffer>;

  /**
   * Delete an object from storage.
   */
  delete(key: string): Promise<void>;

  /**
   * Check if an object exists in storage.
   */
  exists(key: string): Promise<boolean>;

  /**
   * Get signed or direct URL if applicable.
   */
  getUrl?(key: string): Promise<string>;
}
