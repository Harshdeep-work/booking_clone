/**
 * Redis-Only Seat Lock Service (Fix 3)
 * Redis = source of truth for transient locks.
 * DB = final state only (SOLD).
 */
import redis from '../lib/redis';

const LOCK_TTL = 600; // 10 minutes in seconds
const LOCK_PREFIX = 'seat:lock:';

export interface LockResult {
  success: boolean;
  userId?: string;
  expiresAt?: number;
  error?: string;
}

/**
 * Attempt to lock a seat for a user.
 * Uses Redis SETNX (SET if Not eXists) for atomic lock acquisition.
 */
export async function lockSeat(seatId: string, userId: string): Promise<LockResult> {
  const key = `${LOCK_PREFIX}${seatId}`;
  const expiresAt = Date.now() + LOCK_TTL * 1000;
  const value = JSON.stringify({ userId, expiresAt });

  // NX = only set if not exists, EX = expiry in seconds
  const result = await redis.set(key, value, 'EX', LOCK_TTL, 'NX');

  if (result === 'OK') {
    return { success: true, userId, expiresAt };
  }

  // Lock held by someone else — read who
  const existing = await redis.get(key);
  if (existing) {
    const data = JSON.parse(existing);
    if (data.userId === userId) {
      // Re-extend own lock
      await redis.expire(key, LOCK_TTL);
      return { success: true, userId, expiresAt: Date.now() + LOCK_TTL * 1000 };
    }
    return {
      success: false,
      userId: data.userId,
      expiresAt: data.expiresAt,
      error: 'Seat is locked by another user',
    };
  }

  return { success: false, error: 'Seat is unavailable' };
}

/**
 * Release a seat lock. Only the lock owner can release.
 */
export async function unlockSeat(seatId: string, userId: string): Promise<boolean> {
  const key = `${LOCK_PREFIX}${seatId}`;
  const existing = await redis.get(key);

  if (!existing) return true; // Already unlocked

  const data = JSON.parse(existing);
  if (data.userId !== userId) return false; // Not the owner

  await redis.del(key);
  return true;
}

/**
 * Check if a seat is locked and by whom.
 */
export async function getSeatLockStatus(seatId: string): Promise<{
  locked: boolean;
  userId?: string;
  expiresAt?: number;
}> {
  const key = `${LOCK_PREFIX}${seatId}`;
  const existing = await redis.get(key);

  if (!existing) return { locked: false };

  const data = JSON.parse(existing);
  return { locked: true, userId: data.userId, expiresAt: data.expiresAt };
}

/**
 * Get all locks for multiple seats at once (pipeline for performance).
 */
export async function getBulkSeatLockStatus(seatIds: string[]): Promise<
  Map<string, { locked: boolean; userId?: string }>
> {
  if (seatIds.length === 0) return new Map();

  const pipeline = redis.pipeline();
  seatIds.forEach((id) => pipeline.get(`${LOCK_PREFIX}${id}`));
  const results = await pipeline.exec();

  const statusMap = new Map<string, { locked: boolean; userId?: string }>();
  seatIds.forEach((id, i) => {
    const val = results?.[i]?.[1] as string | null;
    if (val) {
      const data = JSON.parse(val);
      statusMap.set(id, { locked: true, userId: data.userId });
    } else {
      statusMap.set(id, { locked: false });
    }
  });

  return statusMap;
}

/**
 * Force-unlock all seats locked by a user (e.g., on disconnect).
 */
export async function unlockAllByUser(userId: string): Promise<string[]> {
  const keys = await redis.keys(`${LOCK_PREFIX}*`);
  const unlockedIds: string[] = [];

  if (keys.length === 0) return unlockedIds;

  const pipeline = redis.pipeline();
  keys.forEach((k) => pipeline.get(k));
  const results = await pipeline.exec();

  const delPipeline = redis.pipeline();
  keys.forEach((key, i) => {
    const val = results?.[i]?.[1] as string | null;
    if (val) {
      const data = JSON.parse(val);
      if (data.userId === userId) {
        delPipeline.del(key);
        unlockedIds.push(key.replace(LOCK_PREFIX, ''));
      }
    }
  });

  if (unlockedIds.length > 0) await delPipeline.exec();
  return unlockedIds;
}
