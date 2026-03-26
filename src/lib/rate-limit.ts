interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store — note: resets on serverless cold start
const store = new Map<string, RateLimitEntry>();

const WINDOW_MS = 60_000;    // 1 minute window
const MAX_EXECUTIONS = 10;   // max 10 per window per user

export function checkRateLimit(userId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = store.get(userId);

  if (!entry || now > entry.resetAt) {
    store.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_EXECUTIONS - 1 };
  }

  if (entry.count >= MAX_EXECUTIONS) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: MAX_EXECUTIONS - entry.count };
}
