import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { cookieUtils } from '@/lib/cookies';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000';

interface WebSocketOptions {
  projectId?: string;
  runId?: string;
  autoConnect?: boolean;
}

export interface WebSocketEvent {
  type: string;
  data: any;
  timestamp: Date;
}

export function useWebSocketEnhanced(options: WebSocketOptions = {}) {
  const { projectId, runId, autoConnect = true } = options;
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<WebSocketEvent | null>(null);
  const listenersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());

  // Initialize socket connection
  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const token = cookieUtils.getToken();
    if (!token) {
      console.warn('No auth token available for WebSocket connection');
      return;
    }

    const socket = io(WS_URL, {
      path: '/ws',
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);

      // Subscribe to project if provided
      if (projectId) {
        socket.emit('subscribe:project', projectId);
      }

      // Subscribe to run if provided
      if (runId) {
        socket.emit('subscribe:run', runId);
      }
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    });

    socket.on('error', (error: any) => {
      console.error('WebSocket error:', error);
    });

    // Listen for all events and broadcast to listeners
    socket.onAny((event: string, data: any) => {
      const eventData: WebSocketEvent = {
        type: event,
        data,
        timestamp: new Date(),
      };
      setLastEvent(eventData);

      // Notify specific listeners
      const listeners = listenersRef.current.get(event);
      if (listeners) {
        listeners.forEach(callback => callback(data));
      }

      // Notify wildcard listeners
      const wildcardListeners = listenersRef.current.get('*');
      if (wildcardListeners) {
        wildcardListeners.forEach(callback => callback(eventData));
      }
    });

    socketRef.current = socket;
  }, [projectId, runId]);

  // Disconnect socket
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  // Subscribe to project updates
  const subscribeToProject = useCallback((id: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('subscribe:project', id);
    }
  }, []);

  // Unsubscribe from project updates
  const unsubscribeFromProject = useCallback((id: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('unsubscribe:project', id);
    }
  }, []);

  // Subscribe to run updates
  const subscribeToRun = useCallback((id: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('subscribe:run', id);
    }
  }, []);

  // Unsubscribe from run updates
  const unsubscribeFromRun = useCallback((id: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('unsubscribe:run', id);
    }
  }, []);

  // Add event listener
  const on = useCallback((event: string, callback: (data: any) => void) => {
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set());
    }
    listenersRef.current.get(event)!.add(callback);

    // Return cleanup function
    return () => {
      const listeners = listenersRef.current.get(event);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          listenersRef.current.delete(event);
        }
      }
    };
  }, []);

  // Remove event listener
  const off = useCallback((event: string, callback: (data: any) => void) => {
    const listeners = listenersRef.current.get(event);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        listenersRef.current.delete(event);
      }
    }
  }, []);

  // Emit event
  const emit = useCallback((event: string, data: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  }, []);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    isConnected,
    lastEvent,
    connect,
    disconnect,
    subscribeToProject,
    unsubscribeFromProject,
    subscribeToRun,
    unsubscribeFromRun,
    on,
    off,
    emit,
  };
}

// Specific hooks for common use cases
export function useProjectEvents(projectId: string | undefined) {
  const [events, setEvents] = useState<WebSocketEvent[]>([]);
  const ws = useWebSocketEnhanced({ projectId, autoConnect: !!projectId });

  useEffect(() => {
    const cleanup = ws.on('*', (event: WebSocketEvent) => {
      setEvents(prev => [...prev.slice(-99), event]); // Keep last 100 events
    });

    return cleanup;
  }, [ws]);

  return { ...ws, events };
}

export function useRunLogs(runId: string | undefined) {
  const [logs, setLogs] = useState<any[]>([]);
  const ws = useWebSocketEnhanced({ runId, autoConnect: !!runId });

  useEffect(() => {
    const cleanup = ws.on('run:log', (log: any) => {
      setLogs(prev => [...prev, log]);
    });

    return cleanup;
  }, [ws, runId]);

  return { ...ws, logs, clearLogs: () => setLogs([]) };
}
