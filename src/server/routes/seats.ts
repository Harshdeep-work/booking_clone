import express, { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { getBulkSeatLockStatus } from '../services/lockService';
import { deriveSeatGeoJSON } from '../services/geojsonService';

const router = express.Router();

/**
 * GET /api/seats?section_id=A101
 * Returns seats for a section with live lock status merged in.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { section_id } = req.query;
    if (!section_id) {
      return res.status(400).json({ error: 'section_id is required' });
    }

    const section = await prisma.section.findUnique({
      where: { section_id: section_id as string },
      include: { seats: true },
    });

    if (!section) {
      return res.status(404).json({ error: 'Section not found' });
    }

    // Get all live lock statuses from Redis
    const seatIds = section.seats.map((s: { seat_id: string }) => s.seat_id);
    const lockStatuses = await getBulkSeatLockStatus(seatIds);

    const seats = section.seats.map((seat) => {
      const lock = lockStatuses.get(seat.seat_id);
      const liveStatus = lock?.locked ? 'LOCKED' : seat.status;

      return {
        seat_id: seat.seat_id,
        row: seat.row,
        number: seat.number,
        x: seat.x,
        y: seat.y,
        lng: seat.lng,
        lat: seat.lat,
        price: Number(seat.price),
        status: liveStatus,
        lockedBy: lock?.userId,
      };
    });

    res.json({ section_id, seats });
  } catch (error) {
    console.error('[API] GET /seats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/seats/geojson?section_id=A101
 * Returns GeoJSON FeatureCollection of seat Points for Mapbox rendering.
 */
router.get('/geojson', async (req: Request, res: Response) => {
  try {
    const { section_id } = req.query;
    if (!section_id) {
      return res.status(400).json({ error: 'section_id is required' });
    }
    const section = await prisma.section.findUnique({
      where: { section_id: section_id as string },
    });
    if (!section) {
      return res.status(404).json({ error: 'Section not found' });
    }
    const geojson = await deriveSeatGeoJSON(section.id);
    res.json(geojson);
  } catch (error) {
    console.error('[API] GET /seats/geojson error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
