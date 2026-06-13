/**
 * DB-backed fixed-window rate limiter (Full_Backend_Spec v4.1 §8.3).
 *
 * Vercel serverless instances share no memory, so the shared Postgres is the
 * only Phase 1 coordination point (no Redis by cost discipline). Traffic at
 * Phase 1 scale makes one upsert per guarded request acceptable.
 */
import { getSql } from '@/lib/db/client'

export interface RateLimitRule {
  /** Logical bucket name, e.g. 'activate' */
  scope: string
  limit: number
  windowSeconds: number
}

export const RATE_LIMIT_RULES = {
  /** §8.3: POST /v2/license/activate — 5/min per IP */
  activate: { scope: 'activate', limit: 5, windowSeconds: 60 },
  /** §8.3: repeated activation failures — lockout 15 min after 5 failures */
  activateFailures: { scope: 'activate-fail', limit: 5, windowSeconds: 15 * 60 },
  /** §8.3: GET /api/license/check — 10/min per IP */
  licenseCheck: { scope: 'license-check', limit: 10, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>

const CLEANUP_PROBABILITY = 0.02
const CLEANUP_RETENTION_SECONDS = 24 * 60 * 60

export function windowStartFor(rule: RateLimitRule, now: Date): Date {
  const windowMs = rule.windowSeconds * 1000
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs)
}

/**
 * Records a hit and returns whether the request is allowed.
 * Set `recordOnly` to count an event (e.g. a failure) without consuming the
 * caller's response path.
 */
export async function hitRateLimit(
  rule: RateLimitRule,
  identifier: string,
  options: { recordOnly?: boolean } = {}
): Promise<{ allowed: boolean; count: number }> {
  const sql = getSql()
  const key = `${rule.scope}:${identifier}`
  const windowStart = windowStartFor(rule, new Date())

  const rows = await sql`
    INSERT INTO rate_limits (key, window_start, count)
    VALUES (${key}, ${windowStart}, 1)
    ON CONFLICT (key, window_start)
    DO UPDATE SET count = rate_limits.count + 1
    RETURNING count
  `
  const count = rows[0].count as number

  if (Math.random() < CLEANUP_PROBABILITY) {
    // Opportunistic cleanup; failures here must never affect the request.
    sql`
      DELETE FROM rate_limits
      WHERE window_start < now() - make_interval(secs => ${CLEANUP_RETENTION_SECONDS})
    `.catch(() => undefined)
  }

  return { allowed: options.recordOnly ? true : count <= rule.limit, count }
}

/** Checks the current window without incrementing (used for failure lockout). */
export async function isRateLimited(
  rule: RateLimitRule,
  identifier: string
): Promise<boolean> {
  const sql = getSql()
  const key = `${rule.scope}:${identifier}`
  const windowStart = windowStartFor(rule, new Date())
  const rows = await sql`
    SELECT count FROM rate_limits
    WHERE key = ${key} AND window_start = ${windowStart}
    LIMIT 1
  `
  return rows.length > 0 && (rows[0].count as number) >= rule.limit
}

export function clientIpFrom(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return headers.get('x-real-ip') ?? 'unknown'
}
