import express, { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { deriveLayoutGeoJSON } from '../services/geojsonService';
import { invalidateGeoJSONCache } from '../services/geojsonService';

const router = express.Router();

/**
 * GET /api/sections?bbox=west,south,east,north&layoutId=xxx (Fix 7: tile-based)
 * Returns only sections within the viewport bounding box.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { layoutId, bbox } = req.query;
    if (!layoutId) return res.status(400).json({ error: 'layoutId is required' });

    const sections = await prisma.section.findMany({
      where: { layoutId: layoutId as string },
      include: {
        rules: true,
        _count: { select: { seats: true } },
        seats: { select: { status: true } },
      },
    });

    // Apply bbox filter if provided
    let filtered = sections;
    if (bbox) {
      const [west, south, east, north] = (bbox as string).split(',').map(Number);
      filtered = sections.filter((sec) => {
        const cx = sec.centerX;
        const cy = sec.centerY;
        return cx >= west && cx <= east && cy >= south && cy <= north;
      });
    }

    const features = filtered.map((section) => {
      const availableCount = section.seats.filter((s) => s.status === 'AVAILABLE').length;
      const rule = section.rules[0];
      return {
        section_id: section.section_id,
        label: section.label,
        category: section.category,
        color: section.color,
        geometry: section.geometry,
        seatCount: section._count.seats,
        availableCount,
        basePrice: rule ? Number(rule.base_price) : 0,
        centerX: section.centerX,
        centerY: section.centerY,
      };
    });

    res.json({ sections: features });
  } catch (error) {
    console.error('[API] GET /sections error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/geojson/:layoutId — Derived GeoJSON (cached in Redis 5 min)
 */
router.get('/geojson/:layoutId', async (req: Request, res: Response) => {
  try {
    const { layoutId } = req.params;
    const geojson = await deriveLayoutGeoJSON(layoutId as string);
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json(geojson);
  } catch (error) {
    console.error('[API] GET /geojson error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
