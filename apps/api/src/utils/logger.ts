import crypto from 'node:crypto';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const LOG_LEVEL_PRIORITIES: Record<LogLevel, number> = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
};

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'tokenhash',
  'refreshtoken',
  'jwt',
  'secret',
  'authorization',
  'cookie',
  'set-cookie',
  'otp',
  'otpcode',
  'aws_secret_access_key',
  's3_secret_access_key',
  'smtp_password',
  'feedtoken',
]);

/**
 * Recursively redacts sensitive keys from log payloads.
 */
export function sanitizeLogData(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;

  if (Buffer.isBuffer(data)) {
    return `<Buffer length=${data.length}>`;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeLogData);
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes('secret') || lowerKey.includes('password')) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeLogData(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

class Logger {
  private environment: string;
  private minLevel: LogLevel;

  constructor() {
    this.environment = process.env.NODE_ENV || 'development';
    this.minLevel = (process.env.LOG_LEVEL as LogLevel) || (this.environment === 'production' ? 'INFO' : 'DEBUG');
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITIES[level] >= LOG_LEVEL_PRIORITIES[this.minLevel];
  }

  private write(level: LogLevel, message: string, meta?: Record<string, any>) {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const cleanMeta = meta ? sanitizeLogData(meta) : undefined;

    if (this.environment === 'production') {
      const logEntry = {
        timestamp,
        level,
        service: 'd-board-api',
        environment: this.environment,
        message,
        ...cleanMeta,
      };
      const jsonString = JSON.stringify(logEntry);
      if (level === 'ERROR') {
        process.stderr.write(jsonString + '\n');
      } else {
        process.stdout.write(jsonString + '\n');
      }
    } else {
      const metaStr = cleanMeta && Object.keys(cleanMeta).length > 0 ? ` ${JSON.stringify(cleanMeta)}` : '';
      const formatted = `[${timestamp}] [${level}] ${message}${metaStr}`;
      if (level === 'ERROR') {
        console.error(formatted);
      } else if (level === 'WARN') {
        console.warn(formatted);
      } else {
        console.log(formatted);
      }
    }
  }

  debug(message: string, meta?: Record<string, any>) {
    this.write('DEBUG', message, meta);
  }

  info(message: string, meta?: Record<string, any>) {
    this.write('INFO', message, meta);
  }

  warn(message: string, meta?: Record<string, any>) {
    this.write('WARN', message, meta);
  }

  error(message: string, meta?: Record<string, any>) {
    this.write('ERROR', message, meta);
  }
}

export const logger = new Logger();
export default logger;
