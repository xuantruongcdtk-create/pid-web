/**
 * Per-user rate limiter backed by Upstash Redis.
 *
 * If UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not configured,
 * this becomes a no-op (always allows) so local development isn't blocked.
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type Limiter = {
  limit: (key: string) => Promise<{
    success: boolean;
    limit: number;
    remaining: number;
    reset: number;
  }>;
};

function makeNoop(): Limiter {
  return {
    async limit() {
      return { success: true, limit: Infinity, remaining: Infinity, reset: 0 };
    },
  };
}

function hasUpstash() {
  return (
    !!process.env.UPSTASH_REDIS_REST_URL &&
    !!process.env.UPSTASH_REDIS_REST_TOKEN &&
    process.env.UPSTASH_REDIS_REST_URL.startsWith("http")
  );
}

const cache = new Map<string, Limiter>();

/**
 * Build (or reuse) a sliding-window limiter.
 * @param prefix    namespace for the keys (e.g. "ai:quiz")
 * @param window    `${number} ${duration}` token used by Upstash Ratelimit
 * @param tokens    max requests in the window
 */
export function getLimiter(prefix: string, window: `${number} ${"s" | "m" | "h"}`, tokens: number): Limiter {
  const cacheKey = `${prefix}|${window}|${tokens}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  if (!hasUpstash()) {
    const noop = makeNoop();
    cache.set(cacheKey, noop);
    return noop;
  }

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

  const rl = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(tokens, window),
    analytics: false,
    prefix,
  });

  const wrapped: Limiter = {
    async limit(key: string) {
      const r = await rl.limit(key);
      return { success: r.success, limit: r.limit, remaining: r.remaining, reset: r.reset };
    },
  };
  cache.set(cacheKey, wrapped);
  return wrapped;
}
