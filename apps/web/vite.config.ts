import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

function isTransientError(err: any): boolean {
  if (!err) return false;
  const transientCodes = new Set([
    'ECONNRESET',
    'ECONNABORTED',
    'ECONNREFUSED',
    'EPIPE',
    'ETIMEDOUT',
  ]);
  if (err.code && transientCodes.has(err.code)) return true;
  if (typeof err.message === 'string' && /ECONNRESET|ECONNABORTED|ECONNREFUSED|EPIPE|ETIMEDOUT/i.test(err.message)) {
    return true;
  }
  if (Array.isArray(err.errors)) {
    return err.errors.some((subErr: any) => isTransientError(subErr));
  }
  return false;
}

function configureProxy(proxy: any) {
  const originalOn = proxy.on.bind(proxy);

  // Intercept listener registration before Vite registers its built-in error/proxyReqWs handlers
  proxy.on = function (event: string, listener: (...args: any[]) => void) {
    if (event === 'error') {
      return originalOn('error', (err: any, req: any, res: any) => {
        if (isTransientError(err)) {
          // Gracefully terminate the response or socket if still open to avoid unhandled socket leaks
          if (res) {
            if ('writeHead' in res && !res.headersSent && !res.writableEnded) {
              res.writeHead(502, { 'Content-Type': 'text/plain' }).end();
            } else if (typeof res.end === 'function' && !res.writableEnded) {
              res.end();
            } else if (typeof res.destroy === 'function' && !res.destroyed) {
              res.destroy();
            }
          }
          return;
        }
        return listener(err, req, res);
      });
    }

    if (event === 'proxyReqWs') {
      return originalOn('proxyReqWs', (proxyReq: any, req: any, socket: any, options: any) => {
        if (socket && typeof socket.on === 'function') {
          const originalSocketOn = socket.on.bind(socket);
          socket.on = function (sEvent: string, sListener: (...args: any[]) => void) {
            if (sEvent === 'error') {
              return originalSocketOn('error', (err: any) => {
                if (isTransientError(err)) {
                  if (typeof socket.destroy === 'function' && !socket.destroyed) {
                    socket.destroy();
                  }
                  return;
                }
                return sListener(err);
              });
            }
            return originalSocketOn(sEvent, sListener);
          };
        }
        return listener(proxyReq, req, socket, options);
      });
    }

    return originalOn(event, listener);
  };
  proxy.addListener = proxy.on;
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
        configure: configureProxy,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:5000',
        ws: true,
        changeOrigin: true,
        configure: configureProxy,
      },
    },
  },
})
