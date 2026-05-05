'use client';
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export interface SeatLockedEvent {
  seat_id: string;
  user_id: string;
  expires_at: number;
}

export interface SectionUpdateEvent {
  section_id: string;
  available_count: number;
  locked_count: number;
  price: number;
}

export interface BulkSeatUpdateEvent {
  seats: Array<{ seat_id: string; status: 'AVAILABLE' | 'LOCKED' | 'SOLD' }>;
}

interface SocketContextValue {
  socket: Socket | null;
  status: ConnectionStatus;
  joinSection: (sectionId: string) => void;
  leaveSection: (sectionId: string) => void;
  onSeatLocked: (cb: (e: SeatLockedEvent) => void) => () => void;
  onSeatUnlocked: (cb: (e: { seat_id: string }) => void) => () => void;
  onSeatSold: (cb: (e: { seat_id: string }) => void) => () => void;
  onSectionUpdate: (cb: (e: SectionUpdateEvent) => void) => () => void;
  onBulkSeatUpdate: (cb: (e: BulkSeatUpdateEvent) => void) => () => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

export function SocketProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const missedHeartbeats = useRef(0);

  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
    const socket = io(socketUrl, {
      auth: { userId },
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    socketRef.current = socket;

    socket.on('connect', () => { setStatus('connected'); missedHeartbeats.current = 0; });
    socket.on('disconnect', () => setStatus('disconnected'));
    socket.on('connect_error', () => setStatus('disconnected'));

    // Heartbeat monitoring (Fix 8)
    socket.on('heartbeat', () => { missedHeartbeats.current = 0; });
    const heartbeatCheck = setInterval(() => {
      missedHeartbeats.current++;
      if (missedHeartbeats.current >= 2) {
        console.warn('[WS] Missed 2 heartbeats — reconnecting');
        socket.disconnect();
        socket.connect();
        missedHeartbeats.current = 0;
      }
    }, 35000);

    return () => {
      clearInterval(heartbeatCheck);
      socket.disconnect();
    };
  }, [userId]);

  const joinSection = useCallback((sectionId: string) => {
    socketRef.current?.emit('join_section', sectionId);
  }, []);

  const leaveSection = useCallback((sectionId: string) => {
    socketRef.current?.emit('leave_section', sectionId);
  }, []);

  const makeListener = useCallback(<T,>(event: string) => {
    return (cb: (e: T) => void) => {
      socketRef.current?.on(event, cb);
      return () => { socketRef.current?.off(event, cb); };
    };
  }, []);

  const value: SocketContextValue = {
    socket: socketRef.current,
    status,
    joinSection,
    leaveSection,
    onSeatLocked: makeListener<SeatLockedEvent>('seat_locked'),
    onSeatUnlocked: makeListener<{ seat_id: string }>('seat_unlocked'),
    onSeatSold: makeListener<{ seat_id: string }>('seat_sold'),
    onSectionUpdate: makeListener<SectionUpdateEvent>('section_update'),
    onBulkSeatUpdate: makeListener<BulkSeatUpdateEvent>('bulk_seat_update'),
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
}
