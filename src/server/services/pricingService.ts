/**
 * Dynamic Pricing Engine (Fix 6)
 * Computes real-time seat prices based on demand, time-to-event, and section rules.
 */
import { PricingRule, SeatCategory } from '@prisma/client';
import { prisma } from '../lib/prisma';
import redis from '../lib/redis';

const CACHE_TTL = 30; // seconds
const CACHE_PREFIX = 'pricing:';

export interface PriceInfo {
  price: number;
  originalPrice: number;
  badge?: 'Amazing Deal' | 'Great Value' | null;
  demandLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'SURGE';
}

const CATEGORY_BASE_PRICES: Record<SeatCategory, number> = {
  FIELD: 800,
  PLATINUM: 500,
  GOLD: 350,
  SILVER: 220,
  BRONZE: 150,
  GENERAL: 80,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getDemandLevel(soldRatio: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'SURGE' {
  if (soldRatio < 0.3) return 'LOW';
  if (soldRatio < 0.6) return 'MEDIUM';
  if (soldRatio < 0.85) return 'HIGH';
  return 'SURGE';
}

function getBadge(effectivePrice: number, basePrice: number): PriceInfo['badge'] {
  const ratio = effectivePrice / basePrice;
  if (ratio <= 0.8) return 'Amazing Deal';
  if (ratio <= 1.05) return 'Great Value';
  return null;
}

export async function getDynamicPrice(
  sectionId: string,
  rule: PricingRule,
  eventDate: Date,
  soldCount: number,
  totalCount: number
): Promise<PriceInfo> {
  const cacheKey = `${CACHE_PREFIX}${sectionId}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const basePrice = Number(rule.base_price);
  const soldRatio = totalCount > 0 ? soldCount / totalCount : 0;
  const daysToEvent = Math.max(
    0,
    Math.ceil((eventDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );

  // Demand factor: scales with sold ratio
  const demandFactor = 1 + soldRatio * (rule.demand_multiplier - 1);

  // Time factor: accelerates in last 7 days
  const timeFactor = daysToEvent < 7
    ? rule.time_factor * 1.5
    : daysToEvent < 30
    ? rule.time_factor * 1.2
    : rule.time_factor;

  const effectivePrice = clamp(
    basePrice * demandFactor * timeFactor,
    Number(rule.min_price),
    Number(rule.max_price)
  );

  const result: PriceInfo = {
    price: Math.round(effectivePrice),
    originalPrice: Math.round(basePrice),
    badge: getBadge(effectivePrice, basePrice),
    demandLevel: getDemandLevel(soldRatio),
  };

  await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
  return result;
}

export async function getDefaultPriceForCategory(category: SeatCategory): Promise<number> {
  return CATEGORY_BASE_PRICES[category] || 100;
}

export async function invalidatePricingCache(sectionId: string): Promise<void> {
  await redis.del(`${CACHE_PREFIX}${sectionId}`);
}
