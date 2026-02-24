/**
 * hooks/useSocketIO.ts - React hook for real-time Socket.IO event streaming
 * 
 * Handles:
 * - Connection/disconnection with exponential backoff
 * - Event subscription and unsubscription
 * - Automatic reconnection on network failure
 * - Event state management
 */

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import io, { Socket } from 'socket.io-client';

export interface BroadcastEvent {
  eventId: string;
  type: string;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  data: Record<string, any>;
}

export interface SocketIOHookOptions {
  url?: string;
  token?: string;
  autoConnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
}

export interface UseSocketIOReturn {
  socket: Socket | null;
  isConnected: boolean;
  isReconnecting: boolean;
  events: BroadcastEvent[];
  subscribe: (eventType: string) => void;
  unsubscribe: (eventType: string) => void;
  clearEvents: () => void;
  error?: string;
}

/**
 * React hook for Socket.IO connection and event listening
 */
export function useSocketIO(options: SocketIOHookOptions = {}): UseSocketIOReturn {
  const {
    url = process.env.NEXT_PUBLIC_SOCKET_IO_URL || 'http://localhost:3002',
    token,
    autoConnect = true,
    maxReconnectAttempts = 5,
    reconnectDelay = 1000,
  } = options;

  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [events, setEvents] = useState<BroadcastEvent[]>([]);
  const [error, setError] = useState<string>();

  const reconnectAttemptsRef = useRef(0);
  const socketRef = useRef<Socket | null>(null);
  const subscriptionsRef = useRef<Set<string>>(new Set());
  const maxEventsRef = useRef(500);

  /**
   * Initialize Socket.IO connection
   */
  useEffect(() => {
    if (!autoConnect) return;

    const setupSocket = () => {
      const newSocket = io(url, {
        reconnection: true,
        reconnectionDelay: reconnectDelay,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: maxReconnectAttempts,
        transports: ['websocket', 'polling'],
      });

      // Connection handler
      newSocket.on('connect', () => {
        console.log('✅ Socket.IO connected');
        setIsConnected(true);
        setIsReconnecting(false);
        reconnectAttemptsRef.current = 0;
        setError(undefined);

        // Authenticate if token provided
        if (token) {
          newSocket.emit('authenticate', { token }, (response: any) => {
            if (response.success) {
              console.log('✅ Authenticated with server');
              // Load event history
              if (response.history && Array.isArray(response.history)) {
                setEvents(response.history);
              }
            } else {
              console.warn('⚠️ Authentication failed:', response.error);
              setError(response.error);
            }
          });
        }
      });

      // Disconnection handler
      newSocket.on('disconnect', () => {
        console.log('📴 Socket.IO disconnected');
        setIsConnected(false);
      });

      // Reconnection handler
      newSocket.on('connect_error', (err) => {
        console.warn('⚠️ Connection error:', err);
        setIsReconnecting(true);
        reconnectAttemptsRef.current++;

        if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          setError('Failed to reconnect after multiple attempts');
        }
      });

      // Event listener for broadcast events
      newSocket.on('event', (event: BroadcastEvent) => {
        console.log('📨 Event received:', event.type);
        setEvents((prev) => {
          const updated = [...prev, event];
          // Keep only recent events
          if (updated.length > maxEventsRef.current) {
            return updated.slice(-maxEventsRef.current);
          }
          return updated;
        });
      });

      socketRef.current = newSocket;
      setSocket(newSocket);
    };

    setupSocket();

    // Cleanup
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [autoConnect, url, token, reconnectDelay, maxReconnectAttempts]);

  /**
   * Subscribe to specific event type
   */
  const subscribe = useCallback(
    (eventType: string) => {
      if (socket && !subscriptionsRef.current.has(eventType)) {
        socket.emit('subscribe', { eventType }, (response: any) => {
          if (response.success) {
            subscriptionsRef.current.add(eventType);
            console.log(`✅ Subscribed to ${eventType}`);
          }
        });
      }
    },
    [socket]
  );

  /**
   * Unsubscribe from specific event type
   */
  const unsubscribe = useCallback(
    (eventType: string) => {
      if (socket && subscriptionsRef.current.has(eventType)) {
        socket.emit('unsubscribe', { eventType }, (response: any) => {
          if (response.success) {
            subscriptionsRef.current.delete(eventType);
            console.log(`✅ Unsubscribed from ${eventType}`);
          }
        });
      }
    },
    [socket]
  );

  /**
   * Clear event history
   */
  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  return {
    socket,
    isConnected,
    isReconnecting,
    events,
    subscribe,
    unsubscribe,
    clearEvents,
    error,
  };
}

/**
 * Hook for filtering events by type
 */
export function useSocketIOEvents(
  socket: Socket | null,
  eventTypes: string[]
): BroadcastEvent[] {
  const [filteredEvents, setFilteredEvents] = useState<BroadcastEvent[]>([]);

  useEffect(() => {
    if (!socket) return;

    // Listen for events
    const handleEvent = (event: BroadcastEvent) => {
      if (eventTypes.includes(event.type)) {
        setFilteredEvents((prev) => [...prev, event].slice(-100)); // Keep last 100
      }
    };

    socket.on('event', handleEvent);

    // Subscribe to relevant event types
    for (const eventType of eventTypes) {
      socket.emit('subscribe', { eventType });
    }

    return () => {
      socket.off('event', handleEvent);
      // Unsubscribe
      for (const eventType of eventTypes) {
        socket.emit('unsubscribe', { eventType });
      }
    };
  }, [socket, eventTypes]);

  return filteredEvents;
}

export default { useSocketIO, useSocketIOEvents };
