type AttemptBucket = {
  failures: number;
  resetAt: number;
  lastFailureAt: number;
};

const buckets = new Map<string, AttemptBucket>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILURES_PER_WINDOW = 8;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function prune(now: number) {
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function isLoginAllowed(email: string) {
  const now = Date.now();
  prune(now);

  const key = normalizeEmail(email);
  const bucket = buckets.get(key);
  if (!bucket) return true;

  return bucket.failures < MAX_FAILURES_PER_WINDOW;
}

export function recordLoginFailure(email: string) {
  const now = Date.now();
  prune(now);

  const key = normalizeEmail(email);
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { failures: 1, resetAt: now + WINDOW_MS, lastFailureAt: now });
    return;
  }

  current.failures += 1;
  current.lastFailureAt = now;
  buckets.set(key, current);
}

export function clearLoginFailures(email: string) {
  buckets.delete(normalizeEmail(email));
}

export function __resetAuthSecurityBucketsForTests() {
  buckets.clear();
}

export function getLoginSecuritySnapshot() {
  const now = Date.now();
  prune(now);

  return [...buckets.entries()]
    .map(([email, bucket]) => ({
      email,
      failures: bucket.failures,
      blocked: bucket.failures >= MAX_FAILURES_PER_WINDOW,
      lastFailureAt: new Date(bucket.lastFailureAt).toISOString(),
      resetAt: new Date(bucket.resetAt).toISOString(),
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    }))
    .sort((a, b) => b.failures - a.failures);
}
