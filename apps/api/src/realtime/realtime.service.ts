import { Server as SocketIOServer, Socket } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import prisma from '../prisma.js';
import { verifyJwt } from '../utils/security.js';
import { RealtimeEventType } from './realtime.types.js';

let io: SocketIOServer | null = null;

/**
 * Extract token from handshake authorization header, auth object, or cookie string
 */
function extractToken(socket: Socket): string | null {
  // 1. Check socket.handshake.auth.token
  if (socket.handshake.auth?.token && typeof socket.handshake.auth.token === 'string') {
    return socket.handshake.auth.token;
  }

  // 2. Check Authorization header
  const authHeader = socket.handshake.headers?.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // 3. Check Cookie header
  const cookieHeader = socket.handshake.headers?.cookie;
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map((c) => c.trim());
    for (const cookie of cookies) {
      if (cookie.startsWith('token=')) {
        return decodeURIComponent(cookie.substring(6));
      }
    }
  }

  return null;
}

/**
 * Initialize Socket.IO server and bind to the HTTP server
 */
export function initRealtime(httpServer: HTTPServer): SocketIOServer {
  const allowedOrigins = [
    process.env.APP_URL || 'http://localhost:5173',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ];

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  // Socket authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = extractToken(socket);
      if (!token) {
        return next(new Error('Authentication error: Missing token'));
      }

      const decoded = verifyJwt(token);
      if (!decoded || !decoded.userId) {
        return next(new Error('Authentication error: Invalid token'));
      }

      // Verify user exists in database
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, username: true, email: true },
      });

      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.data.userId = user.id;
      socket.data.username = user.username;
      socket.data.email = user.email;

      next();
    } catch (err: any) {
      return next(new Error('Authentication error: ' + (err?.message || 'Unauthorized')));
    }
  });

  // Socket connection handling
  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId;
    const userRoom = `user:${userId}`;

    // Automatically join the user's private channel
    socket.join(userRoom);

    // Join a project room with server-side authorization check
    socket.on('join:project', async (data: { projectId: string }, callback?: (res: any) => void) => {
      try {
        const projectId = data?.projectId;
        if (!projectId || typeof projectId !== 'string') {
          if (callback) callback({ success: false, error: 'Invalid project ID' });
          return;
        }

        // Authorize: Check if user is owner or active member
        const hasAccess = await prisma.project.findFirst({
          where: {
            id: projectId,
            OR: [
              { createdById: userId },
              { members: { some: { userId } } },
            ],
          },
          select: { id: true },
        });

        if (!hasAccess) {
          if (callback) callback({ success: false, error: 'Unauthorized to join project room' });
          return;
        }

        const projectRoom = `project:${projectId}`;
        socket.join(projectRoom);

        if (callback) {
          callback({ success: true, room: projectRoom });
        }
      } catch (err: any) {
        if (callback) {
          callback({ success: false, error: err?.message || 'Failed to join project room' });
        }
      }
    });

    // Leave a project room
    socket.on('leave:project', (data: { projectId: string }, callback?: (res: any) => void) => {
      try {
        const projectId = data?.projectId;
        if (projectId && typeof projectId === 'string') {
          socket.leave(`project:${projectId}`);
        }
        if (callback) {
          callback({ success: true });
        }
      } catch (err: any) {
        if (callback) {
          callback({ success: false, error: err?.message });
        }
      }
    });

    socket.on('disconnect', () => {
      // Disconnection cleanup handled automatically by Socket.io
    });
  });

  return io;
}

/**
 * Get Socket.IO instance
 */
export function getIO(): SocketIOServer | null {
  return io;
}

/**
 * Publish an event to a specific project room
 */
export function publishToProject(projectId: string, event: RealtimeEventType, payload: any): void {
  if (!io) return;
  try {
    io.to(`project:${projectId}`).emit(event, {
      ...payload,
      timestamp: payload.timestamp || new Date().toISOString(),
    });
  } catch (err) {
    console.error(`[Realtime] Failed to publish event ${event} to project ${projectId}:`, err);
  }
}

/**
 * Publish an event to a single user room
 */
export function publishToUser(userId: string, event: RealtimeEventType, payload: any): void {
  if (!io) return;
  try {
    io.to(`user:${userId}`).emit(event, {
      ...payload,
      timestamp: payload.timestamp || new Date().toISOString(),
    });
  } catch (err) {
    console.error(`[Realtime] Failed to publish event ${event} to user ${userId}:`, err);
  }
}

/**
 * Publish an event to multiple user rooms
 */
export function publishToUsers(userIds: string[], event: RealtimeEventType, payload: any): void {
  if (!io || !userIds || userIds.length === 0) return;
  try {
    const timestamp = payload.timestamp || new Date().toISOString();
    for (const userId of userIds) {
      io.to(`user:${userId}`).emit(event, {
        ...payload,
        timestamp,
      });
    }
  } catch (err) {
    console.error(`[Realtime] Failed to publish event ${event} to users:`, err);
  }
}
