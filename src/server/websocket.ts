/**
 * Socket.IO WebSocket Server (Fix 8 — Enriched Events)
 * Room-based subscriptions to prevent flooding clients with irrelevant events.
 * Batched section_update every 2s via setInterval.
 */
import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import redis from './lib/redis';
import { unlockAllByUser } from './services/lockService';

export interface SeatLockedPayload {
  seat_id: string;
  user_id: string;
  expires_at: number;
}

export interface SeatUnlockedPayload { seat_id: string; }
export interface SeatSoldPayload { seat_id: string; section_id: string; }

export interface SectionUpdatePayload {
  section_id: string;
  available_count: number;
  locked_count: number;
  price: number;
}

export interface BulkSeatUpdatePayload {
  seats: Array<{ seat_id: string; status: 'AVAILABLE' | 'LOCKED' | 'SOLD' }>;
}

// Pending section updates to be batched
const pendingSectionUpdates = new Map<string, SectionUpdatePayload>();

export function initSocketServer(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
    },
    pingInterval: 30000,
    pingTimeout: 5000,
  });

  // Batch section updates every 2 seconds (Fix 8)
  setInterval(() => {
    if (pendingSectionUpdates.size === 0) return;
    pendingSectionUpdates.forEach((payload, sectionId) => {
      io.to(`section:${sectionId}`).emit('section_update', payload);
    });
    pendingSectionUpdates.clear();
  }, 2000);

  // Heartbeat every 30 seconds (Fix 8)
  setInterval(() => {
    io.emit('heartbeat', { ts: Date.now() });
  }, 30000);

  io.on('connection', (socket) => {
    const userId = socket.handshake.auth?.userId || socket.id;
    console.log(`[WS] Client connected: ${userId}`);

    // Join section room for targeted updates
    socket.on('join_section', (sectionId: string) => {
      socket.join(`section:${sectionId}`);
      console.log(`[WS] ${userId} joined section:${sectionId}`);
    });

    socket.on('leave_section', (sectionId: string) => {
      socket.leave(`section:${sectionId}`);
    });

    // Client disconnected — release all their locks
    socket.on('disconnect', async () => {
      console.log(`[WS] Client disconnected: ${userId}`);
      const released = await unlockAllByUser(userId);
      if (released.length > 0) {
        // Emit bulk unlock for released seats
        const bulkPayload: BulkSeatUpdatePayload = {
          seats: released.map((seat_id) => ({ seat_id, status: 'AVAILABLE' })),
        };
        io.emit('bulk_seat_update', bulkPayload);
      }
    });
  });

  return io;
}

// Called by API routes to emit events
let _io: SocketIOServer | null = null;

export function setIO(io: SocketIOServer) {
  _io = io;
}

export function emitSeatLocked(payload: SeatLockedPayload, sectionId: string) {
  _io?.to(`section:${sectionId}`).emit('seat_locked', payload);
  scheduleSectionUpdate(sectionId);
}

export function emitSeatUnlocked(payload: SeatUnlockedPayload, sectionId: string) {
  _io?.to(`section:${sectionId}`).emit('seat_unlocked', payload);
  scheduleSectionUpdate(sectionId);
}

export function emitSeatSold(payload: SeatSoldPayload) {
  _io?.to(`section:${payload.section_id}`).emit('seat_sold', payload);
  scheduleSectionUpdate(payload.section_id);
}

export function emitBulkSeatUpdate(payload: BulkSeatUpdatePayload) {
  _io?.emit('bulk_seat_update', payload);
}

export function scheduleSectionUpdate(sectionId: string, data?: Partial<SectionUpdatePayload>) {
  const existing = pendingSectionUpdates.get(sectionId) || {
    section_id: sectionId,
    available_count: 0,
    locked_count: 0,
    price: 0,
  };
  pendingSectionUpdates.set(sectionId, { ...existing, ...data });
}
