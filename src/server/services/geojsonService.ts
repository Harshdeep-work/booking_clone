/**
 * GeoJSON Derivation Service (Fix 2)
 * GeoJSON is never stored as a blob.
 * It is computed from sections + seats and Redis-cached for 5 minutes.
 */
import { prisma } from '../lib/prisma';
import redis from '../lib/redis';

const GEOJSON_TTL = 300; // 5 minutes
const GEOJSON_PREFIX = 'geojson:';

export interface SectionFeature {
  type: 'Feature';
  id: string;
  geometry: object;
  properties: {
    section_id: string;
    label: string;
    category: string;
    color: string;
    seatCount: number;
    availableCount: number;
    soldCount: number;
    lockedCount: number;
    height: number;
    centerLng: number;
    centerLat: number;
  };
}

const CATEGORY_HEIGHTS: Record<string, number> = {
  FIELD: 25,
  PLATINUM: 20,
  GOLD: 16,
  SILVER: 12,
  BRONZE: 8,
  GENERAL: 5,
};

export async function deriveLayoutGeoJSON(layoutId: string): Promise<object> {
  const cacheKey = `${GEOJSON_PREFIX}${layoutId}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const sections = await prisma.section.findMany({
    where: { layoutId },
    include: {
      _count: {
        select: { seats: true },
      },
      seats: {
        select: { status: true },
      },
    },
  });

  const features: SectionFeature[] = sections.map((section) => {
    const availableCount = section.seats.filter((s) => s.status === 'AVAILABLE').length;
    const soldCount = section.seats.filter((s) => s.status === 'SOLD').length;
    const lockedCount = section.seats.filter((s) => s.status === 'LOCKED').length;

    return {
      type: 'Feature',
      id: section.section_id,
      geometry: section.geometry as object,
      properties: {
        section_id: section.section_id,
        label: section.label,
        category: section.category,
        color: section.color,
        seatCount: section._count.seats,
        availableCount,
        soldCount,
        lockedCount,
        height: CATEGORY_HEIGHTS[section.category] || 5,
        centerLng: section.centerX,
        centerLat: section.centerY,
      },
    };
  });

  const geojson = {
    type: 'FeatureCollection',
    features,
  };

  await redis.setex(cacheKey, GEOJSON_TTL, JSON.stringify(geojson));
  return geojson;
}

export async function deriveSeatGeoJSON(sectionId: string): Promise<object> {
  const cacheKey = `${GEOJSON_PREFIX}seats:${sectionId}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const seats = await prisma.seat.findMany({
    where: { sectionId },
    select: {
      seat_id: true,
      row: true,
      number: true,
      lng: true,
      lat: true,
      price: true,
      status: true,
    },
  });

  const features = seats.map((seat) => ({
    type: 'Feature',
    id: seat.seat_id,
    geometry: {
      type: 'Point',
      coordinates: [seat.lng, seat.lat],
    },
    properties: {
      seat_id: seat.seat_id,
      row: seat.row,
      number: seat.number,
      price: Number(seat.price),
      status: seat.status,
    },
  }));

  const geojson = { type: 'FeatureCollection', features };
  await redis.setex(cacheKey, 60, JSON.stringify(geojson)); // Short TTL for seats
  return geojson;
}

export async function invalidateGeoJSONCache(layoutId: string): Promise<void> {
  await redis.del(`${GEOJSON_PREFIX}${layoutId}`);
}

export async function invalidateSeatGeoJSONCache(sectionId: string): Promise<void> {
  await redis.del(`${GEOJSON_PREFIX}seats:${sectionId}`);
}
