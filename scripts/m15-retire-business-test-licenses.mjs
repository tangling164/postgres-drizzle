import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnvFile() {
  const envPath = join(root, '.env')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separator = trimmed.indexOf('=')
    if (separator <= 0) continue
    const key = trimmed.slice(0, separator).trim()
    let value = trimmed.slice(separator + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

function arg(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : null
}

loadEnvFile()

const buyerEmail = String(arg('--buyer-email') ?? '').trim().toLowerCase()
assert.match(buyerEmail, /^[^\s@]+@[^\s@]+\.[^\s@]+$/, '--buyer-email is required')

const connectionString = process.env.POSTGRES_URL_NON_POOLING
assert.ok(connectionString, 'POSTGRES_URL_NON_POOLING is required')
const databaseUrl = new URL(connectionString)
assert.equal(
  databaseUrl.hostname.toLowerCase().includes('-pooler.'),
  false,
  'Refusing to use a pooled database URL'
)

const apply = process.argv.includes('--apply')
const confirmation = arg('--confirm')
if (apply) {
  assert.equal(
    confirmation,
    'RETIRE_BUSINESS_TEST_LICENSES',
    '--apply requires --confirm RETIRE_BUSINESS_TEST_LICENSES'
  )
}

const sql = postgres(databaseUrl.toString(), {
  ssl: 'require',
  max: 1,
  prepare: false,
})

try {
  const candidates = await sql`
    SELECT
      l.status,
      l.activated_account_id IS NOT NULL AS activated,
      l.valid_until >= now() AS unexpired
    FROM licenses l
    JOIN orders o ON o.id = l.order_id
    WHERE lower(o.buyer_email) = ${buyerEmail}
      AND l.plan = 'business'
      AND l.status IN ('pending', 'active')
  `
  const summary = {
    matchingLicenses: candidates.length,
    activeLicenses: candidates.filter((row) => row.status === 'active').length,
    pendingLicenses: candidates.filter((row) => row.status === 'pending').length,
    activatedLicenses: candidates.filter((row) => row.activated).length,
    unexpiredLicenses: candidates.filter((row) => row.unexpired).length,
  }

  if (!apply) {
    console.log(JSON.stringify({ mode: 'dry-run', ...summary }, null, 2))
  } else {
    const result = await sql.begin(async (tx) => {
      const locked = await tx`
        SELECT l.id, l.activated_account_id
        FROM licenses l
        JOIN orders o ON o.id = l.order_id
        WHERE lower(o.buyer_email) = ${buyerEmail}
          AND l.plan = 'business'
          AND l.status IN ('pending', 'active')
        FOR UPDATE OF l
      `
      for (const license of locked) {
        await tx`
          UPDATE licenses
          SET status = 'revoked', cancelled_at = COALESCE(cancelled_at, now())
          WHERE id = ${license.id}
        `
        if (license.activated_account_id) {
          await tx`
            UPDATE accounts a
            SET plan = 'free',
                plan_expires_at = NULL,
                entitlement_status = 'revoked',
                updated_at = now()
            WHERE a.id = ${license.activated_account_id}
              AND NOT EXISTS (
                SELECT 1 FROM licenses other
                WHERE other.activated_account_id = a.id
                  AND other.status = 'active'
              )
          `
        }
      }
      return locked.length
    })
    console.log(JSON.stringify({ mode: 'applied', retiredLicenses: result }, null, 2))
  }
} finally {
  await sql.end({ timeout: 1 })
}
