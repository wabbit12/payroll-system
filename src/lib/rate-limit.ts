/**
 * In-memory rate limiter (local / single instance).
 * For multi-instance production, swap in Upstash Redis later.
 */

type LimitResult = { success: boolean; remaining: number };

type MemoryEntry = { count: number; resetAt: number };

const memoryStore = new Map<string, MemoryEntry>();

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<LimitResult> {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || entry.resetAt <= now) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    return { success: false, remaining: 0 };
  }

  entry.count += 1;
  return { success: true, remaining: limit - entry.count };
}
