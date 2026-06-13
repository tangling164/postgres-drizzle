/**
 * Lazy Postgres client for Vercel serverless (Phase 1 data access layer).
 *
 * - Runtime queries: DATABASE_URL (Neon pooled / PgBouncer).
 * - Transactions (webhook idempotency): POSTGRES_URL_NON_POOLING when set,
 *   because FOR UPDATE + sql.begin is unreliable on pooler transaction mode.
 * - Strips channel_binding=require — breaks some serverless postgres clients.
 */
import postgres from 'postgres'

type Sql = ReturnType<typeof postgres>

let pooledClient: Sql | null = null
let directClient: Sql | null = null

function sanitizeConnectionString(connectionString: string): string {
  try {
    const parsed = new URL(connectionString)
    parsed.searchParams.delete('channel_binding')
    return parsed.toString()
  } catch {
    return connectionString.replace(/([?&])channel_binding=[^&]*&?/g, '$1').replace(/[?&]$/, '')
  }
}

function createClient(connectionString: string): Sql {
  return postgres(sanitizeConnectionString(connectionString), {
    ssl: 'require',
    max: 1,
    prepare: false,
  })
}

export interface GetSqlOptions {
  /** Use Neon direct connection for multi-statement transactions. */
  transaction?: boolean
}

export function getSql(options: GetSqlOptions = {}): Sql {
  if (options.transaction) {
    if (directClient) return directClient
    const connectionString =
      process.env.POSTGRES_URL_NON_POOLING ??
      process.env.DATABASE_URL ??
      process.env.POSTGRES_URL
    if (!connectionString) {
      throw new Error(
        'Database URL is not configured (set DATABASE_URL or POSTGRES_URL_NON_POOLING)'
      )
    }
    directClient = createClient(connectionString)
    return directClient
  }

  if (pooledClient) return pooledClient
  const connectionString =
    process.env.DATABASE_URL ?? process.env.POSTGRES_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured')
  }
  pooledClient = createClient(connectionString)
  return pooledClient
}

export type { Sql }
