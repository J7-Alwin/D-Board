import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingId = req.headers['x-request-id'];
  const requestId = typeof incomingId === 'string' && incomingId.trim().length > 0 && incomingId.length <= 128
    ? incomingId.trim()
    : crypto.randomUUID();

  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}

export default requestIdMiddleware;
