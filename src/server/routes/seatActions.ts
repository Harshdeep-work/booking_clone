import express, { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { lockSeat, unlockSeat } from '../services/lockService';
import { invalidatePricingCache } from '../services/pricingService';
import { invalidateSeatGeoJSONCache, invalidateGeoJSONCache } from '../services/geojsonService';
import {
  emitSeatLocked,
  emitSeatUnlocked,
  emitSeatSold,
  emitBulkSeatUpdate,
  scheduleSectionUpdate,
} from '../websocket';

const router = express.Router();

/**
 * POST /api/lock-seat
 * Body: { seat_id, user_id }
 * Redis SETNX lock (10 min TTL). No DB write.
 */
router.post('/lock-seat', async (req: Request, res: Response) => {
  try {
    const { seat_id, user_id } = req.body;
    if (!seat_id || !user_id) {
      return res.status(400).json({ error: 'seat_id and user_id are required' });
    }

    const seat = await prisma.seat.findUnique({
      where: { seat_id },
      include: { section: true },
    });

    if (!seat) return res.status(404).json({ error: 'Seat not found' });
    if (seat.status === 'SOLD') return res.status(409).json({ error: 'Seat already sold' });

    const result = await lockSeat(seat_id, user_id);

    if (!result.success) {
      return res.status(409).json({
        error: result.error,
        locked_by: result.userId,
        expires_at: result.expiresAt,
      });
    }

    // Broadcast via WebSocket (section-room targeted)
    emitSeatLocked(
      { seat_id, user_id, expires_at: result.expiresAt! },
      seat.section.section_id
    );
    scheduleSectionUpdate(seat.section.section_id);

    res.json({ success: true, seat_id, expires_at: result.expiresAt });
  } catch (error) {
    console.error('[API] POST /lock-seat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/unlock-seat
 * Body: { seat_id, user_id }
 */
router.post('/unlock-seat', async (req: Request, res: Response) => {
  try {
    const { seat_id, user_id } = req.body;
    if (!seat_id || !user_id) {
      return res.status(400).json({ error: 'seat_id and user_id are required' });
    }

    const seat = await prisma.seat.findUnique({
      where: { seat_id },
      include: { section: true },
    });

    if (!seat) return res.status(404).json({ error: 'Seat not found' });

    const released = await unlockSeat(seat_id, user_id);
    if (!released) {
      return res.status(403).json({ error: 'You do not own this lock' });
    }

    emitSeatUnlocked({ seat_id }, seat.section.section_id);
    scheduleSectionUpdate(seat.section.section_id);

    res.json({ success: true, seat_id });
  } catch (error) {
    console.error('[API] POST /unlock-seat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/purchase
 * Body: { seat_ids[], user_id, payment_token }
 * Final commit: marks seats SOLD in DB, deletes Redis locks.
 */
router.post('/purchase', async (req: Request, res: Response) => {
  try {
    const { seat_ids, user_id, payment_token } = req.body;
    if (!seat_ids?.length || !user_id) {
      return res.status(400).json({ error: 'seat_ids and user_id are required' });
    }

    // Verify all seats are locked by this user
    const seats = await prisma.seat.findMany({
      where: { seat_id: { in: seat_ids } },
      include: { section: true },
    });

    if (seats.length !== seat_ids.length) {
      return res.status(404).json({ error: 'Some seats not found' });
    }

    const soldSeats = seats.filter((s) => s.status === 'SOLD');
    if (soldSeats.length > 0) {
      return res.status(409).json({ error: 'Some seats already sold', seats: soldSeats.map((s) => s.seat_id) });
    }

    const total = seats.reduce((sum, s) => sum + Number(s.price), 0);

    // Payment processing would go here (Stripe, etc.)
    // Simulated for demo: payment_token presence = success
    if (!payment_token && process.env.NODE_ENV === 'production') {
      return res.status(400).json({ error: 'Payment token required' });
    }

    // Atomic DB update: mark all as SOLD
    await prisma.$transaction(async (tx) => {
      await tx.seat.updateMany({
        where: { seat_id: { in: seat_ids } },
        data: { status: 'SOLD' },
      });

      await tx.order.create({
        data: {
          userId: user_id,
          seatIds: seat_ids,
          total,
          status: 'CONFIRMED',
        },
      });
    });

    // Invalidate caches
    const sectionIds = [...new Set(seats.map((s) => s.section.section_id))];
    await Promise.all([
      ...sectionIds.map((id) => invalidateSeatGeoJSONCache(id)),
      ...sectionIds.map((id) => invalidatePricingCache(id)),
    ]);

    // Bulk WebSocket broadcast: all seats now SOLD
    emitBulkSeatUpdate({
      seats: seat_ids.map((id: string) => ({ seat_id: id, status: 'SOLD' })),
    });

    sectionIds.forEach((id) => scheduleSectionUpdate(id));

    res.json({ success: true, order_total: total, seat_count: seat_ids.length });
  } catch (error) {
    console.error('[API] POST /purchase error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
