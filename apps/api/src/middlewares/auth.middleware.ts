import { Request, Response, NextFunction } from 'express';
import { verifyJwt, JwtPayload } from '../utils/security.js';
import { sessionService } from '../services/session.service.js';

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

export async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    let token: string | undefined;

    // Check cookie
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    // Check Authorization header fallback
    const authHeader = req.headers.authorization;
    if (!token && authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Authentication required. Please sign in.',
      });
      return;
    }

    const payload = verifyJwt(token);

    // If session ID is attached, verify session in PostgreSQL / Redis
    if (payload.sessionId) {
      const { valid } = await sessionService.validateSession(payload.sessionId);
      if (!valid) {
        res.status(401).json({
          success: false,
          message: 'Session has been revoked or expired. Please sign in again.',
        });
        return;
      }
      sessionService.touchSession(payload.sessionId).catch(() => {});
    }

    req.user = payload;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired session. Please sign in again.',
    });
  }
}

export async function optionalAuthenticate(req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> {
  try {
    let token: string | undefined;

    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    const authHeader = req.headers.authorization;
    if (!token && authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (token) {
      const payload = verifyJwt(token);
      if (payload.sessionId) {
        const { valid } = await sessionService.validateSession(payload.sessionId);
        if (valid) {
          req.user = payload;
          sessionService.touchSession(payload.sessionId).catch(() => {});
        }
      } else {
        req.user = payload;
      }
    }
  } catch {
    // Gracefully ignore error for optional authentication
  }
  next();
}
