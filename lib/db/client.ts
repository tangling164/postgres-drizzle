/**
 * Lazy Postgres client for Vercel serverless (Phase 1 data access layer).
 *
 * Phase 1 uses explicit SQL via the `postgres` tagged-template client so the
 * row locks / conditional updates match the spec SQL one-to-one
 * (Full_Backend_Spec v4.1 §5.1 / §5.2). The connection is created on first
 * use, never at module import, so builds and tests run without a database.
 */
import postgres from 'postgres'

type Sql = ReturnType<typeof postgres>

let client: Sql | null = null

export function getSql(): Sql {
  if (client) return client
  const connectionString =
    process.env.DATABASE_URL ?? process.env.POSTGRES_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured')
  }
  client = postgres(connectionString, {
    ssl: 'require',
    // Pooled (PgBouncer) endpoint expected; keep per-instance connections low.
    max: 1,
    prepare: false,
  })
  return client
}

export type { Sql }
