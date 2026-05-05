import express, { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { invalidateGeoJSONCache } from '../services/geojsonService';
import { invalidatePricingCache } from '../services/pricingService';

const router = express.Router();

/**
 * POST /api/layout — Create a new layout version
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { eventId, name, sections } = req.body;
    if (!eventId || !name) return res.status(400).json({ error: 'eventId and name required' });

    const lastLayout = await prisma.layout.findFirst({
      where: { eventId },
      orderBy: { version: 'desc' },
    });
    const newVersion = (lastLayout?.version || 0) + 1;

    const layout = await prisma.layout.create({
      data: {
        eventId,
        name,
        version: newVersion,
        sections: sections
          ? {
              create: sections.map((sec: any) => ({
                section_id: sec.section_id,
                label: sec.label,
                category: sec.category || 'GENERAL',
                color: sec.color || '#4A90E2',
                geometry: sec.geometry,
                centerX: sec.centerX || 0,
                centerY: sec.centerY || 0,
              })),
            }
          : undefined,
      },
      include: { sections: true },
    });

    res.status(201).json(layout);
  } catch (error) {
    console.error('[API] POST /layout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/layout/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const layout = await prisma.layout.findUnique({
      where: { id: req.params.id as string },
      include: {
        sections: {
          include: { rules: true, _count: { select: { seats: true } } },
        },
      },
    });
    if (!layout) return res.status(404).json({ error: 'Layout not found' });
    res.json(layout);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/layout/:id — Update layout (increments cache invalidation)
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const layout = await prisma.layout.update({
      where: { id: req.params.id as string },
      data: { name: req.body.name, isActive: req.body.isActive },
    });
    await invalidateGeoJSONCache(req.params.id as string);
    res.json(layout);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/layout/:id/versions — All layout versions for an event
 */
router.get('/:id/versions', async (req: Request, res: Response) => {
  try {
    const layout = await prisma.layout.findUnique({ where: { id: req.params.id as string } });
    if (!layout) return res.status(404).json({ error: 'Layout not found' });

    const versions = await prisma.layout.findMany({
      where: { eventId: layout.eventId },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, name: true, isActive: true, createdAt: true },
    });
    res.json(versions);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/layout/:id/rollback/:version
 */
router.post('/:id/rollback/:version', async (req: Request, res: Response) => {
  try {
    const { id, version } = req.params;
    const layout = await prisma.layout.findUnique({ where: { id: id as string } });
    if (!layout) return res.status(404).json({ error: 'Layout not found' });

    const targetVersion = await prisma.layout.findUnique({
      where: { eventId_version: { eventId: layout.eventId, version: parseInt(version as string) } },
      include: { sections: { include: { rules: true } } },
    });

    if (!targetVersion) return res.status(404).json({ error: 'Version not found' });

    // Deactivate all versions, activate target
    await prisma.$transaction([
      prisma.layout.updateMany({ where: { eventId: layout.eventId }, data: { isActive: false } }),
      prisma.layout.update({ where: { id: targetVersion.id }, data: { isActive: true } }),
    ]);

    await invalidateGeoJSONCache(id as string);
    res.json({ success: true, active_layout: targetVersion.id, version: targetVersion.version });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
