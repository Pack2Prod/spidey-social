/**
 * WebSocket context for real-time updates (new posts, new messages).
 * Connects when signed in, passes JWT in query for auth.
 * Optionally sends lat/lng for targeted web_added push (geo fan-out).
 */
import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { wsUrl } from '../config';
import { getPosition } from './geolocation';
import type { WebPost } from '../types';
import type { ChatMessage } from '../api/webs';

export type WsEvent =
  | { type: 'web_added'; web: WebPost & { lat?: number; lng?: number; visibilityRadiusMi?: number } }
  | { type: 'message_new'; webId: string; message: ChatMessage }
  | { type: 'swing_in'; webId: string; swingerId: string; content?: string };

interface WebSocketContextValue {
  isConnected: boolean;
  subscribe: (handler: (ev: WsEvent) => void) => () => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = React.useState(false);
  const handlersRef = useRef<Set<(ev: WsEvent) => void>>(new Set());
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);

  const connect = useCallback(async () => {
    if (!wsUrl) return;
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      if (!token) return;
      let url = `${wsUrl.replace(/\/$/, '')}?token=${encodeURIComponent(token)}`;
      const coords = await Promise.race([
        getPosition({ allowCache: true }),
        new Promise<null>((r) => setTimeout(() => r(null), 3000)),
      ]);
      if (coords != null) {
        url += `&lat=${coords.lat}&lng=${coords.lng}`;
      }
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        reconnectAttempts.current = 0;
      };

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data as string) as WsEvent;
          handlersRef.current.forEach((h) => h(data));
        } catch {
          // ignore invalid JSON
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;
        if (reconnectAttempts.current < 5) {
          const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 30000);
          reconnectAttempts.current += 1;
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      // auth not ready or failed
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const subscribe = useCallback((handler: (ev: WsEvent) => void) => {
    handlersRef.current.add(handler);
    return () => {
      handlersRef.current.delete(handler);
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{ isConnected, subscribe }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const ctx = useContext(WebSocketContext);
  return ctx ?? { isConnected: false, subscribe: () => () => {} };
}
