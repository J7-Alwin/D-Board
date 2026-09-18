import http from "http";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
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
import { errorHandler } from "./middlewares/error.middleware.js";
import { initRealtime } from "./realtime/realtime.service.js";
import { authRateLimiter, invitationRateLimiter, apiRateLimiter } from "./middlewares/rateLimit.middleware.js";
import { getRedisClient, closeRedis } from "./redis/redis.client.js";
import { initWorkers, closeWorkers } from "./jobs/index.js";

dotenv.config();

const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.APP_URL || "http://localhost:5173";

// Initialize Redis and BullMQ Workers
getRedisClient();
initWorkers();

// Initialize Socket.IO
initRealtime(httpServer);

// Middleware
app.use(
  cors({
    origin: [CLIENT_URL, "http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(cookieParser());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Health check
app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      success: true,
      message: "D-Board API is running",
      database: "connected",
    });
  } catch (error) {
    console.error("Database connection failed:", error);

    res.status(500).json({
      success: false,
      message: "D-Board API is running, but database connection failed",
      database: "disconnected",
    });
  }
});

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

// Centralized error handler
app.use(errorHandler);


// Start server
httpServer.listen(PORT, () => {
  console.log(`D-Board API running on http://localhost:${PORT}`);
});

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

    // 2. Close BullMQ workers and queues
    await closeWorkers();

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