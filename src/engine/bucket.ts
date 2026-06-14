// Refilling token bucket — THE rate-limit primitive, shared by the local backend and
// the `tree` Edge Function (SSOT: one implementation, parameterized by cap + refill
// rate, so the per-device watering can and the per-IP flood ceiling are the same code).

export interface Bucket {
  tokens: number
  /** ms epoch the tokens were last computed at. */
  at: number
}

/** Advance a bucket to `now`, refilling one token per `refillMs` (capped, clock-skew safe). */
export function refillBucket(
  bucket: Bucket | null | undefined,
  now: number,
  cap: number,
  refillMs: number,
): Bucket {
  if (!bucket) return { tokens: cap, at: now }
  const elapsed = Math.max(0, now - bucket.at)
  return { tokens: Math.min(cap, bucket.tokens + elapsed / refillMs), at: now }
}

/** What a client sees: whole tokens, and when the next drop lands (0 if full). */
export function bucketView(
  bucket: Bucket,
  cap: number,
  refillMs: number,
): { tokens: number; nextTokenAt: number } {
  const tokens = Math.floor(bucket.tokens)
  if (tokens >= cap) return { tokens: cap, nextTokenAt: 0 }
  const frac = bucket.tokens - tokens
  return { tokens, nextTokenAt: bucket.at + (1 - frac) * refillMs }
}
