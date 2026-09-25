import { Readable } from 'node:stream';
import fs from 'node:fs';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { StorageProvider } from './storage.interface.js';

export interface S3StorageConfig {
  region?: string;
  bucket?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  endpoint?: string;
  forcePathStyle?: boolean;
}

export class S3StorageProvider implements StorageProvider {
  private client: S3Client;
  private bucket: string;

  constructor(config?: S3StorageConfig) {
    this.bucket = config?.bucket || process.env.S3_BUCKET || process.env.AWS_S3_BUCKET || 'd-board-files';
    const region = config?.region || process.env.S3_REGION || process.env.AWS_REGION || 'auto';
    const accessKeyId = config?.accessKeyId || process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = config?.secretAccessKey || process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
    const endpoint = config?.endpoint || process.env.S3_ENDPOINT || process.env.AWS_ENDPOINT;
    const forcePathStyle = config?.forcePathStyle ?? (process.env.S3_FORCE_PATH_STYLE === 'true' || process.env.AWS_S3_FORCE_PATH_STYLE === 'true');

    this.client = new S3Client({
      region,
      endpoint: endpoint || undefined,
      forcePathStyle,
      credentials:
        accessKeyId && secretAccessKey
          ? {
              accessKeyId,
              secretAccessKey,
            }
          : undefined,
    });
  }

  public getBucketName(): string {
    return this.bucket;
  }

  /**
   * Upload binary data directly to AWS S3 bucket.
   */
  async upload(key: string, data: Buffer | Uint8Array, mimeType: string): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: data,
      ContentType: mimeType,
    });
    await this.client.send(command);
  }

  /**
   * Stream upload directly from a local temp file path to S3/R2 (memory safe).
   */
  async uploadFile(key: string, filePath: string, mimeType: string): Promise<void> {
    const stat = await fs.promises.stat(filePath);
    const readStream = fs.createReadStream(filePath);
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: readStream,
      ContentType: mimeType,
      ContentLength: stat.size,
    });
    await this.client.send(command);
  }

  /**
   * Get a readable stream for the object from S3.
   */
  async getStream(key: string): Promise<Readable> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    const response = await this.client.send(command);
    if (!response.Body) {
      throw new Error(`S3 object ${key} returned an empty body`);
    }
    return response.Body as unknown as Readable;
  }

  /**
   * Get full buffer for the object from S3.
   */
  async getBuffer(key: string): Promise<Buffer> {
    const stream = await this.getStream(key);
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      stream.on('error', (err) => reject(err));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  /**
   * Delete an object from S3.
   */
  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    await this.client.send(command);
  }

  /**
   * Check if an object exists in S3.
   */
  async exists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      await this.client.send(command);
      return true;
    } catch (err: any) {
      if (
        err.name === 'NotFound' ||
        err.name === 'NoSuchKey' ||
        err.$metadata?.httpStatusCode === 404
      ) {
        return false;
      }
      throw err;
    }
  }

  /**
   * Generate a Presigned PUT URL for direct-to-S3 client upload.
   */
  async getPresignedUploadUrl(key: string, mimeType: string, expiresInSeconds = 900): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimeType,
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  /**
   * Generate a Presigned GET URL for direct-from-S3 download/preview.
   */
  async getPresignedDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  /**
   * Get signed URL if applicable.
   */
  async getUrl(key: string): Promise<string> {
    return this.getPresignedDownloadUrl(key, 3600);
  }

  /**
   * Non-destructive health check verifying connectivity to S3/R2 bucket
   */
  async checkHealth(): Promise<{ status: 'healthy' | 'degraded'; error?: string }> {
    try {
      await this.exists(`health-check-${Date.now()}`);
      return { status: 'healthy' };
    } catch (err: any) {
      return { status: 'degraded', error: err?.message || 'S3/R2 storage unavailable' };
    }
  }
}
