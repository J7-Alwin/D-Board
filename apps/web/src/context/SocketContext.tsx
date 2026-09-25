import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

function resolveSocketUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl) return 'http://localhost:5000';
  const trimmed = envUrl.trim().replace(/\/+$/, '');
  return trimmed.replace(/\/api$/, '');
}

const SOCKET_SERVER_URL = resolveSocketUrl();

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    // Connect to Socket.IO server with HTTP-only cookie support
    const socket = io(SOCKET_SERVER_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message);
      setIsConnected(false);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [isAuthenticated, user?.id]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  return useContext(SocketContext);
};

/**
 * Custom hook for subscribing to a specific project room with auto cleanup
 */
export const useProjectSocket = (projectId?: string) => {
  const { socket, isConnected } = useSocket();

  useEffect(() => {
    if (!socket || !isConnected || !projectId) return;

    socket.emit('join:project', { projectId }, (res: any) => {
      if (res && !res.success) {
        console.warn(`[Socket] Could not join project ${projectId}:`, res.error);
      }
    });

    return () => {
      socket.emit('leave:project', { projectId });
    };
  }, [socket, isConnected, projectId]);

  return { socket, isConnected };
};
