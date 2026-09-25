import http from "http";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { env, validateEnv } from "./config/env.js";
import prisma from "./prisma.js";
import authRoutes from "./routes/auth.routes.js";
import { projectRoutes } from "./routes/project.routes.js";
import { dashboardRoutes } from "./routes/dashboard.routes.js";
import { globalWorkRoutes } from "./routes/globalWork.routes.js";
import { userInvitationRoutes } from "./routes/invitation.routes.js";
import globalNotesRoutes from "./routes/globalNotes.routes.js";
import globalCalendarRoutes from "./routes/globalCalendar.routes.js";
import { globalFilesRoutes } from "./routes/globalFiles.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import userRoutes from "./routes/user.routes.js";
import { globalActivityRoutes } from "./routes/globalActivity.routes.js";
import { searchRoutes } from "./routes/search.routes.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { requestIdMiddleware } from "./middlewares/requestId.middleware.js";
import { initRealtime } from "./realtime/realtime.service.js";
import { authRateLimiter, invitationRateLimiter, apiRateLimiter } from "./middlewares/rateLimit.middleware.js";
import { getRedisClient, closeRedis } from "./redis/redis.client.js";
import { initWorkers, closeWorkers } from "./jobs/index.js";
import healthRoutes from "./routes/health.routes.js";
import docsRoutes from "./routes/docs.routes.js";

dotenv.config();

// Startup validation of configuration environment
validateEnv();

const app = express();
const httpServer = http.createServer(app);
const PORT = env.PORT || 5000;

// Initialize Redis and BullMQ Workers (only if not running purely unit tests)
if (process.env.NODE_ENV !== "test") {
  getRedisClient();
  if (process.env.ENABLE_EMBEDDED_WORKER !== "false") {
    initWorkers();
    console.log("[Worker] Embedded BullMQ workers initialized in API process");
  } else {
    console.log("[Worker] Embedded BullMQ workers disabled via ENABLE_EMBEDDED_WORKER=false");
  }
  initRealtime(httpServer);
}

// Strict CORS Origins
const allowedOrigins = [
  env.APP_URL,
  ...(env.CLIENT_URL ? [env.CLIENT_URL] : []),
  ...(env.NODE_ENV === "production" ? [] : ["http://localhost:5173", "http://127.0.0.1:5173"]),
];

// Security Headers with Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'", ...allowedOrigins],
        fontSrc: ["'self'", "https:", "data:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: env.NODE_ENV === "production" ? {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    } : false,
    frameguard: { action: "deny" },
    noSniff: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  })
);

// CORS
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked request from origin: ${origin}`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
    exposedHeaders: ["X-Request-Id"],
  })
);

// Request / Correlation ID tracking
app.use(requestIdMiddleware);

app.use(cookieParser());
// Hardened request body limits (file uploads use multer with diskStorage up to 50MB per file)
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// System Health & Documentation Endpoints
app.use("/api", healthRoutes);
app.use("/api", docsRoutes);

// API Routes with Rate Limiting
app.use("/api/auth", authRateLimiter, authRoutes);
app.use("/api/invitations", invitationRateLimiter, userInvitationRoutes);
app.use("/api/projects", apiRateLimiter, projectRoutes);
app.use("/api/dashboard", apiRateLimiter, dashboardRoutes);
app.use("/api/work", apiRateLimiter, globalWorkRoutes);
app.use("/api/notes", apiRateLimiter, globalNotesRoutes);
app.use("/api/calendar", apiRateLimiter, globalCalendarRoutes);
app.use("/api/files", apiRateLimiter, globalFilesRoutes);
app.use("/api/notifications", apiRateLimiter, notificationRoutes);
app.use("/api/user", apiRateLimiter, userRoutes);
app.use("/api/activities", apiRateLimiter, globalActivityRoutes);
app.use("/api/search", apiRateLimiter, searchRoutes);

// Centralized error handler
app.use(errorHandler);

// Start server (only in non-test mode)
if (process.env.NODE_ENV !== "test") {
  httpServer.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`D-Board API running on http://0.0.0.0:${PORT}`);
  });
}

// Graceful Shutdown Management
let isShuttingDown = false;
async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n[Shutdown] Received ${signal}. Starting graceful shutdown...`);

  try {
    // 1. Close HTTP / Socket.IO server
    await new Promise<void>((resolve) => {
      httpServer.close(() => {
        console.log('[Shutdown] HTTP server closed');
        resolve();
      });
    });

    // 2. Close BullMQ workers and queues (if running in this process)
    if (process.env.ENABLE_EMBEDDED_WORKER !== "false") {
      await closeWorkers();
    }

    // 3. Close Redis connection
    await closeRedis();

    // 4. Disconnect Prisma
    await prisma.$disconnect();
    console.log('[Shutdown] PostgreSQL disconnected');

    console.log('[Shutdown] Graceful shutdown completed cleanly.');
    process.exit(0);
  } catch (err) {
    console.error('[Shutdown Error]:', err);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export { app, httpServer };
export default app;