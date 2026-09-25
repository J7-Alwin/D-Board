import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';

/**
 * CSRF Protection Middleware
 * Protects cookie-authenticated state-changing requests (POST, PUT, PATCH, DELETE)
 * against Cross-Site Request Forgery, especially critical when COOKIE_SAME_SITE=none.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // 1. Safe HTTP methods do not change state
  const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
  if (safeMethods.has(req.method.toUpperCase())) {
    return next();
  }

  // 2. Exempt OAuth callback and public webhooks
  const exemptPaths = [
    '/api/auth/google/callback',
    '/api/auth/google',
  ];
  if (exemptPaths.some((p) => req.path.startsWith(p))) {
    return next();
  }

  // 3. Compile trusted origins
  const trustedOrigins = new Set<string>();
  if (env.APP_URL) trustedOrigins.add(new URL(env.APP_URL).origin);
  if (env.CLIENT_URL) trustedOrigins.add(new URL(env.CLIENT_URL).origin);

  if (env.NODE_ENV !== 'production') {
    trustedOrigins.add('http://localhost:5173');
    trustedOrigins.add('http://127.0.0.1:5173');
    trustedOrigins.add('http://localhost:5000');
    trustedOrigins.add('http://127.0.0.1:5000');
    trustedOrigins.add('http://localhost:3000');
    trustedOrigins.add('http://127.0.0.1:3000');
  }

  // 4. Extract Origin or Referer header
  let requestOrigin: string | null = null;
  const originHeader = req.headers.origin;
  const refererHeader = req.headers.referer;

  if (originHeader && typeof originHeader === 'string' && originHeader !== 'null') {
    try {
      requestOrigin = new URL(originHeader).origin;
    } catch {
      requestOrigin = originHeader;
    }
  } else if (refererHeader && typeof refererHeader === 'string') {
    try {
      requestOrigin = new URL(refererHeader).origin;
    } catch {
      requestOrigin = null;
    }
  }

  // 5. If Origin or Referer is supplied, it MUST match a trusted origin
  if (requestOrigin) {
    if (!trustedOrigins.has(requestOrigin)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'CSRF_BLOCKED',
          message: `Cross-Site Request Forgery blocked: Request origin "${requestOrigin}" is not authorized.`,
        },
      });
      return;
    }
    return next();
  }

  // 6. If no Origin and no Referer:
  // Check Sec-Fetch-Site header (modern browsers send this on all HTTP requests)
  const secFetchSite = req.headers['sec-fetch-site'];
  if (secFetchSite === 'cross-site') {
    res.status(403).json({
      success: false,
      error: {
        code: 'CSRF_BLOCKED',
        message: 'Cross-Site Request Forgery blocked: Cross-site request rejected.',
      },
    });
    return;
  }

  // Preserve legitimate non-browser/server-to-server requests where required
  next();
}
