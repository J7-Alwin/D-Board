import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
}

export interface EnvConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  APP_URL: string;
  CLIENT_URL?: string;
  DATABASE_URL: string;
  REDIS_URL: string;
  JWT_SECRET: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_CALLBACK_URL?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_USER?: string;
  SMTP_PASSWORD?: string;
  EMAIL_FROM?: string;
  MAX_FILE_SIZE_MB: number;
  STORAGE_DRIVER?: string;
  STORAGE_LOCAL_PATH?: string;
  S3_ENDPOINT?: string;
  S3_REGION?: string;
  S3_BUCKET?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
  ENABLE_EMBEDDED_WORKER?: boolean;
  COOKIE_SAME_SITE?: 'lax' | 'none' | 'strict';
}

export function validateEnv(envInput: NodeJS.ProcessEnv = process.env): EnvConfig {
  const isProd = envInput.NODE_ENV === 'production';
  const nodeEnv = (envInput.NODE_ENV as 'development' | 'production' | 'test') || 'development';
  const port = parseInt(envInput.PORT || '5000', 10);
  const clientUrl = envInput.CLIENT_URL || (isProd ? '' : 'http://localhost:5173');
  const appUrl = envInput.APP_URL || (isProd ? '' : 'http://localhost:5000');
  const databaseUrl = envInput.DATABASE_URL || '';
  const redisUrl = envInput.REDIS_URL || 'redis://127.0.0.1:6379';
  const storageDriver = envInput.STORAGE_DRIVER || (envInput.S3_ACCESS_KEY_ID || envInput.AWS_ACCESS_KEY_ID ? 's3' : 'local');
  const s3Bucket = envInput.S3_BUCKET || envInput.AWS_S3_BUCKET;
  const s3AccessKeyId = envInput.S3_ACCESS_KEY_ID || envInput.AWS_ACCESS_KEY_ID;
  const s3SecretAccessKey = envInput.S3_SECRET_ACCESS_KEY || envInput.AWS_SECRET_ACCESS_KEY;
  const s3Endpoint = envInput.S3_ENDPOINT || envInput.AWS_ENDPOINT;
  const s3Region = envInput.S3_REGION || envInput.AWS_REGION || 'auto';
  const enableEmbeddedWorker = envInput.ENABLE_EMBEDDED_WORKER !== 'false';
  const cookieSameSite = (envInput.COOKIE_SAME_SITE as 'lax' | 'none' | 'strict') || 'lax';

  const jwtSecret = envInput.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('[Config Error] Missing required secret: JWT_SECRET must be explicitly defined in environment (.env). Hardcoded fallbacks are strictly prohibited.');
  }
  if (jwtSecret.length < 32) {
    throw new Error('[Config Error] Invalid secret: JWT_SECRET must be at least 32 characters long.');
  }

  if (isProd) {
    if (!databaseUrl) {
      throw new Error('[Config Error] Missing required production config: DATABASE_URL must be defined.');
    }
    if (!appUrl) {
      throw new Error('[Config Error] Missing required production config: APP_URL must be defined.');
    }
    if (appUrl.includes('localhost') || appUrl.includes('127.0.0.1')) {
      throw new Error('[Config Error] Invalid production config: APP_URL cannot point to localhost in production.');
    }
    if (!clientUrl) {
      throw new Error('[Config Error] Missing required production config: CLIENT_URL must be defined.');
    }
    if (clientUrl.includes('localhost') || clientUrl.includes('127.0.0.1')) {
      throw new Error('[Config Error] Invalid production config: CLIENT_URL cannot point to localhost in production.');
    }
    if (appUrl === clientUrl) {
      throw new Error('[Config Error] Invalid production config: APP_URL and CLIENT_URL must not be identical in production.');
    }
    if (!envInput.SMTP_HOST || !envInput.SMTP_USER || !envInput.SMTP_PASSWORD) {
      throw new Error('[Config Error] Missing required production email config: SMTP_HOST, SMTP_USER, and SMTP_PASSWORD must be defined for transactional email dispatch.');
    }
    if (storageDriver === 's3') {
      if (!s3Bucket) {
        throw new Error('[Config Error] Missing required S3 storage config: S3_BUCKET must be defined when STORAGE_DRIVER=s3.');
      }
      if (!s3AccessKeyId || !s3SecretAccessKey) {
        throw new Error('[Config Error] Missing required S3 credentials: S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be defined when STORAGE_DRIVER=s3.');
      }
    }
    if (envInput.GOOGLE_CLIENT_ID && !envInput.GOOGLE_CLIENT_SECRET) {
      throw new Error('[Config Error] Incomplete Google OAuth config: GOOGLE_CLIENT_SECRET is missing.');
    }
    if (envInput.GOOGLE_CALLBACK_URL && (envInput.GOOGLE_CALLBACK_URL.includes('localhost') || envInput.GOOGLE_CALLBACK_URL.includes('127.0.0.1'))) {
      throw new Error('[Config Error] Invalid production config: GOOGLE_CALLBACK_URL cannot point to localhost in production.');
    }
  }

  return {
    NODE_ENV: nodeEnv,
    PORT: isNaN(port) ? 5000 : port,
    APP_URL: appUrl,
    CLIENT_URL: clientUrl,
    DATABASE_URL: databaseUrl,
    REDIS_URL: redisUrl,
    JWT_SECRET: jwtSecret,
    GOOGLE_CLIENT_ID: envInput.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: envInput.GOOGLE_CLIENT_SECRET,
    GOOGLE_CALLBACK_URL: envInput.GOOGLE_CALLBACK_URL,
    SMTP_HOST: envInput.SMTP_HOST,
    SMTP_PORT: envInput.SMTP_PORT ? parseInt(envInput.SMTP_PORT, 10) : undefined,
    SMTP_USER: envInput.SMTP_USER,
    SMTP_PASSWORD: envInput.SMTP_PASSWORD,
    EMAIL_FROM: envInput.EMAIL_FROM,
    MAX_FILE_SIZE_MB: parseInt(envInput.MAX_FILE_SIZE_MB || '50', 10),
    STORAGE_DRIVER: storageDriver,
    STORAGE_LOCAL_PATH: envInput.STORAGE_LOCAL_PATH,
    S3_ENDPOINT: s3Endpoint,
    S3_REGION: s3Region,
    S3_BUCKET: s3Bucket,
    S3_ACCESS_KEY_ID: s3AccessKeyId,
    S3_SECRET_ACCESS_KEY: s3SecretAccessKey,
    ENABLE_EMBEDDED_WORKER: enableEmbeddedWorker,
    COOKIE_SAME_SITE: cookieSameSite,
  };
}

export const env = validateEnv();
export default env;
