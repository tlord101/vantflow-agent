import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';

interface WebSocketState {
  socket: Socket | null;
  connected: boolean;
  connect: (token: string) => void;
  disconnect: () => void;
  subscribeToProject: (projectId: string) => void;
  unsubscribeFromProject: (projectId: string) => void;
  subscribeToRun: (runId: string) => void;
  unsubscribeFromRun: (runId: string) => void;
}

export const useWebSocket = create<WebSocketState>((set, get) => ({
  socket: null,
  connected: false,

  connect: (token: string) => {
    const socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000', {
      path: '/ws',
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('WebSocket connected');
      set({ connected: true });
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      set({ connected: false });
    });

    socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    set({ socket });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, connected: false });
    }
  },

  subscribeToProject: (projectId: string) => {
    const { socket } = get();
    if (socket) {
      socket.emit('subscribe:project', projectId);
    }
  },

  unsubscribeFromProject: (projectId: string) => {
    const { socket } = get();
    if (socket) {
      socket.emit('unsubscribe:project', projectId);
    }
  },

  subscribeToRun: (runId: string) => {
    const { socket } = get();
    if (socket) {
      socket.emit('subscribe:run', runId);
    }
  },

  unsubscribeFromRun: (runId: string) => {
    const { socket } = get();
    if (socket) {
      socket.emit('unsubscribe:run', runId);
    }
  },
}));

// Hook for listening to WebSocket events
export function useWebSocketEvent(event: string, handler: (data: any) => void) {
  const socket = useWebSocket((state) => state.socket);

  React.useEffect(() => {
    if (!socket) return;

    socket.on(event, handler);

    return () => {
      socket.off(event, handler);
    };
  }, [socket, event, handler]);
}

// React import for useEffect
import React from 'react';
