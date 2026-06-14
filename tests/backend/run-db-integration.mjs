import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import ts from 'typescript'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..', '..')

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

loadEnvFile()

const testUrl = process.env.M15_TEST_DATABASE_URL
if (!testUrl) {
  console.error('M15_TEST_DATABASE_URL is required and must point to a dedicated Neon test branch.')
  process.exit(2)
}

function databaseTarget(value) {
  if (!value) return null
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase().replace(/-pooler(?=\.)/, '')
    return `${host}${url.pathname.toLowerCase()}`
  } catch {
    return null
  }
}

const testTarget = databaseTarget(testUrl)
const applicationTargets = [
  databaseTarget(process.env.DATABASE_URL),
  databaseTarget(process.env.POSTGRES_URL_NON_POOLING),
].filter(Boolean)
if (!testTarget || applicationTargets.includes(testTarget)) {
  console.error('Refusing to run: M15_TEST_DATABASE_URL matches a normal application database URL.')
  process.exit(2)
}
if (new URL(testUrl).hostname.toLowerCase().includes('-pooler.')) {
  console.error('Refusing to run: M15_TEST_DATABASE_URL must use a direct, non-pooled Neon connection.')
  process.exit(2)
}

const buildDir = join(here, '.build-integration')
const schema = `formalert_m15_test_${randomBytes(6).toString('hex')}`
assert.match(schema, /^formalert_m15_test_[0-9a-f]+$/)

const scoped = new URL(testUrl)
scoped.searchParams.set('options', `-c search_path=${schema}`)
const scopedUrl = scoped.toString()
const admin = postgres(testUrl, { ssl: 'require', max: 1, prepare: false })
let sql

const sources = [
  'lib/db/client.ts',
  'lib/backend/accounts.ts',
  'lib/backend/plans.ts',
  'lib/backend/license.ts',
  'lib/backend/entitlement.ts',
  'lib/backend/send-quota.ts',
  'lib/backend/creem-catalog.ts',
  'lib/backend/creem.ts',
  'lib/backend/emails.ts',
  'lib/backend/creem-handlers.ts',
  'lib/backend/webhook-events.ts',
  'lib/backend/downgrade.ts',
]

function compileSources() {
  rmSync(buildDir, { recursive: true, force: true })
  for (const sourcePath of sources) {
    const absolute = join(root, sourcePath)
    let code = readFileSync(absolute, 'utf8')
    const fileDir = dirname(sourcePath)
    code = code.replace(/from '@\/(.*?)'/g, (_match, target) => {
      let rel = relative(fileDir, target).replace(/\\/g, '/')
      if (!rel.startsWith('.')) rel = `./${rel}`
      return `from '${rel}'`
    })
    const output = ts.transpileModule(code, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
      },
    }).outputText
    const outFile = join(buildDir, sourcePath.replace(/\.ts$/, '.js'))
    mkdirSync(dirname(outFile), { recursive: true })
    writeFileSync(outFile, output)
  }
}

async function migrate() {
  await admin.unsafe(`CREATE SCHEMA "${schema}"`)
  sql = postgres(scopedUrl, { ssl: 'require', max: 10, prepare: false })
  const migrationDir = join(root, 'lib', 'db', 'migrations')
  for (const file of (await readdir(migrationDir)).filter((name) => name.endsWith('.sql')).sort()) {
    await sql.unsafe(await readFile(join(migrationDir, file), 'utf8'))
  }
}

async function createFreeAccount(email) {
  const rows = await sql`
    INSERT INTO accounts (google_subject, email)
    VALUES (${`sub-${randomBytes(5).toString('hex')}`}, ${email})
    RETURNING id
  `
  await sql`
    INSERT INTO free_trials (account_id, expires_at)
    VALUES (${rows[0].id}, now() + interval '7 days')
  `
  return rows[0].id
}

async function run() {
  await migrate()
  compileSources()

  process.env.DATABASE_URL = scopedUrl
  process.env.POSTGRES_URL_NON_POOLING = scopedUrl
  process.env.LICENSE_PEPPER = 'm15-integration-pepper'
  process.env.RESEND_API_KEY = ''
  process.env.RESEND_FROM_EMAIL = ''
  process.env.NODE_ENV = 'test'

  const requireBuilt = createRequire(join(buildDir, 'index.js'))
  const accounts = requireBuilt('./lib/backend/accounts.js')
  const quota = requireBuilt('./lib/backend/send-quota.js')
  const webhookEvents = requireBuilt('./lib/backend/webhook-events.js')
  const creemHandlers = requireBuilt('./lib/backend/creem-handlers.js')
  const downgrade = requireBuilt('./lib/backend/downgrade.js')

  const concurrentAccounts = await Promise.all(
    Array.from({ length: 8 }, () =>
      accounts.ensureAccount('sub-concurrent-bootstrap', 'bootstrap@example.com')
    )
  )
  assert.equal(new Set(concurrentAccounts.map((account) => account.id)).size, 1)
  assert.equal(
    Number(
      (
        await sql`
          SELECT count(*) AS count
          FROM free_trials
          WHERE account_id = ${concurrentAccounts[0].id}
        `
      )[0].count
    ),
    1
  )
  console.log('PASS concurrent account bootstrap creates one account and one Free trial')

  const freeAccountId = await createFreeAccount('free@example.com')
  const concurrentReservations = await Promise.all(
    Array.from({ length: 31 }, () => quota.reserveAccountSend(freeAccountId))
  )
  const reservations = concurrentReservations
    .filter((result) => result.kind === 'reserved')
    .map((result) => result.reservationId)
  const deniedReservations = concurrentReservations.filter((result) => result.kind === 'denied')
  assert.equal(reservations.length, 30)
  assert.equal(deniedReservations.length, 1)
  assert.equal(deniedReservations[0].reason, 'free_trial_exhausted')
  assert.equal((await quota.releaseAccountSend(freeAccountId, reservations[0])).released, true)
  assert.equal((await quota.releaseAccountSend(freeAccountId, reservations[0])).released, false)
  assert.equal((await quota.reserveAccountSend(freeAccountId)).kind, 'reserved')
  assert.equal(
    Number(
      (
        await sql`
          SELECT count(*) AS count
          FROM send_reservations
          WHERE account_id = ${freeAccountId}
        `
      )[0].count
    ),
    30
  )
  console.log('PASS concurrent account-level Free 30/31 boundary and idempotent release')

  const eventInput = {
    provider: 'creem',
    eventId: 'evt-integration',
    eventType: 'checkout.completed',
    payloadSha256: 'a'.repeat(64),
  }
  const concurrentClaims = await Promise.all(
    Array.from({ length: 8 }, () => webhookEvents.claimWebhookEvent(eventInput))
  )
  assert.equal(concurrentClaims.filter((claim) => claim.claimed).length, 1)
  assert.equal(concurrentClaims.filter((claim) => !claim.claimed).length, 7)
  const firstClaim = concurrentClaims.find((claim) => claim.claimed)
  assert.equal(firstClaim.attemptCount, 1)
  await webhookEvents.failWebhookEvent('creem', eventInput.eventId, firstClaim.attemptCount)
  const retryClaim = await webhookEvents.claimWebhookEvent(eventInput)
  assert.equal(retryClaim.claimed, true)
  assert.equal(retryClaim.attemptCount, 2)
  await webhookEvents.completeWebhookEvent('creem', eventInput.eventId, retryClaim.attemptCount)
  await webhookEvents.failWebhookEvent('creem', eventInput.eventId, firstClaim.attemptCount)
  assert.equal((await webhookEvents.claimWebhookEvent(eventInput)).status, 'processed')
  console.log('PASS concurrent Webhook claim, retry ownership, and completion idempotency')

  const paidEvent = {
    kind: 'paid',
    orderId: 'ord-integration',
    subscriptionId: 'sub-integration',
    buyerEmail: 'buyer@example.com',
    plan: 'standard',
    billingCycle: 'monthly',
    amountCents: 500,
    currency: 'USD',
    periodEnd: new Date('2027-01-01T00:00:00Z'),
    sourceType: 'checkout.completed',
  }
  await assert.rejects(
    () =>
      creemHandlers.handleCreemEvent({
        ...paidEvent,
        orderId: 'ord-business-disabled',
        subscriptionId: 'sub-business-disabled',
        plan: 'business',
      }),
    /Business sales are not enabled/
  )
  assert.equal(
    Number(
      (
        await sql`
          SELECT count(*) AS count
          FROM orders
          WHERE creem_order_id = 'ord-business-disabled'
        `
      )[0].count
    ),
    0
  )

  await creemHandlers.handleCreemEvent({
    ...paidEvent,
    orderId: 'txn-out-of-order-first',
    subscriptionId: 'sub-out-of-order',
    periodEnd: new Date('2027-01-10T00:00:00Z'),
    sourceType: 'subscription.paid',
  })
  await creemHandlers.handleCreemEvent({
    ...paidEvent,
    orderId: 'ord-out-of-order-late',
    subscriptionId: 'sub-out-of-order',
    periodEnd: new Date('2027-01-10T00:00:00Z'),
    sourceType: 'checkout.completed',
  })
  assert.equal(
    Number(
      (
        await sql`
          SELECT count(*) AS count
          FROM licenses
          WHERE creem_subscription_id = 'sub-out-of-order'
        `
      )[0].count
    ),
    1
  )
  assert.equal(
    Number(
      (
        await sql`
          SELECT count(*) AS count
          FROM orders
          WHERE creem_subscription_id = 'sub-out-of-order'
        `
      )[0].count
    ),
    1
  )
  assert.equal(
    Number(
      (
        await sql`
          SELECT count(*) AS count
          FROM creem_order_aliases
          WHERE creem_order_id = 'ord-out-of-order-late'
        `
      )[0].count
    ),
    1
  )
  await creemHandlers.handleCreemEvent({
    kind: 'refund_or_dispute',
    orderId: 'ord-out-of-order-late',
    disposition: 'refunded',
  })
  assert.equal(
    (
      await sql`
        SELECT status
        FROM licenses
        WHERE creem_subscription_id = 'sub-out-of-order'
      `
    )[0].status,
    'revoked'
  )

  await creemHandlers.handleCreemEvent(paidEvent)
  await creemHandlers.handleCreemEvent(paidEvent)
  assert.equal(Number((await sql`SELECT count(*) AS count FROM orders WHERE creem_order_id = 'ord-integration'`)[0].count), 1)
  assert.equal(Number((await sql`SELECT count(*) AS count FROM licenses WHERE creem_subscription_id = 'sub-integration'`)[0].count), 1)

  await creemHandlers.handleCreemEvent({
    ...paidEvent,
    orderId: 'txn-renewal',
    periodEnd: new Date('2027-02-01T00:00:00Z'),
    sourceType: 'subscription.paid',
  })
  assert.equal(
    new Date((await sql`SELECT valid_until FROM licenses WHERE creem_subscription_id = 'sub-integration'`)[0].valid_until).toISOString(),
    '2027-02-01T00:00:00.000Z'
  )
  await creemHandlers.handleCreemEvent({
    ...paidEvent,
    orderId: 'txn-stale-renewal',
    periodEnd: new Date('2027-01-15T00:00:00Z'),
    sourceType: 'subscription.paid',
  })
  assert.equal(
    new Date((await sql`SELECT valid_until FROM licenses WHERE creem_subscription_id = 'sub-integration'`)[0].valid_until).toISOString(),
    '2027-02-01T00:00:00.000Z'
  )

  const paidAccountId = await createFreeAccount('paid@example.com')
  await sql`
    UPDATE licenses SET status = 'active', activated_account_id = ${paidAccountId}
    WHERE creem_subscription_id = 'sub-integration'
  `
  await sql`
    UPDATE accounts
    SET plan = 'standard', plan_expires_at = '2027-02-01T00:00:00Z', entitlement_status = 'active'
    WHERE id = ${paidAccountId}
  `
  await creemHandlers.handleCreemEvent({ kind: 'cancelled', subscriptionId: 'sub-integration' })
  assert.equal((await sql`SELECT cancel_at_period_end FROM licenses WHERE creem_subscription_id = 'sub-integration'`)[0].cancel_at_period_end, true)
  assert.match(
    (await creemHandlers.handleCreemEvent({ kind: 'cancelled', subscriptionId: 'sub-integration' })).note,
    /ignored/
  )
  await creemHandlers.handleCreemEvent({ kind: 'payment_failed', subscriptionId: 'sub-integration', buyerEmail: null })
  assert.equal((await sql`SELECT entitlement_status FROM accounts WHERE id = ${paidAccountId}`)[0].entitlement_status, 'payment_issue')
  await creemHandlers.handleCreemEvent({ kind: 'refund_or_dispute', orderId: 'ord-integration', disposition: 'refunded' })
  assert.equal((await sql`SELECT status FROM licenses WHERE creem_subscription_id = 'sub-integration'`)[0].status, 'revoked')
  assert.equal((await sql`SELECT status FROM orders WHERE creem_order_id = 'ord-integration'`)[0].status, 'refunded')
  assert.match(
    (await creemHandlers.handleCreemEvent({ kind: 'refund_or_dispute', orderId: 'ord-integration', disposition: 'refunded' })).note,
    /already applied/
  )
  console.log('PASS purchase, duplicate, renewal, cancellation, payment failure, and refund lifecycle')

  const driftAccountId = await createFreeAccount('drift@example.com')
  const driftOrder = await sql`
    INSERT INTO orders (creem_order_id, buyer_email, plan, billing_cycle, status)
    VALUES ('ord-drift', 'drift@example.com', 'standard', 'monthly', 'completed')
    RETURNING id
  `
  await sql`
    INSERT INTO licenses (code_hash, order_id, plan, status, activated_account_id, valid_until)
    VALUES (
      'drift-hash', ${driftOrder[0].id}, 'standard', 'active',
      ${driftAccountId}, now() + interval '30 days'
    )
  `
  await sql`
    UPDATE accounts SET plan = 'standard', plan_expires_at = now() - interval '1 day'
    WHERE id = ${driftAccountId}
  `
  assert.equal(
    (await downgrade.runExpiredDowngrades()).some((item) => item.email === 'drift@example.com'),
    false
  )
  assert.equal((await sql`SELECT plan FROM accounts WHERE id = ${driftAccountId}`)[0].plan, 'standard')
  assert.ok(
    new Date((await sql`SELECT plan_expires_at FROM accounts WHERE id = ${driftAccountId}`)[0].plan_expires_at).getTime() >
      Date.now()
  )
  console.log('PASS downgrade reconciles stale account expiry from an active paid license')

  const expiredAccountId = await createFreeAccount('expired@example.com')
  const expiredOrder = await sql`
    INSERT INTO orders (creem_order_id, buyer_email, plan, billing_cycle, status)
    VALUES ('ord-expired', 'expired@example.com', 'standard', 'monthly', 'completed')
    RETURNING id
  `
  await sql`
    INSERT INTO licenses (code_hash, order_id, plan, status, activated_account_id, valid_until)
    VALUES ('expired-hash', ${expiredOrder[0].id}, 'standard', 'active', ${expiredAccountId}, now() - interval '1 day')
  `
  await sql`
    UPDATE accounts SET plan = 'standard', plan_expires_at = now() - interval '1 day'
    WHERE id = ${expiredAccountId}
  `
  const downgraded = await downgrade.runExpiredDowngrades()
  assert.equal(downgraded.some((item) => item.email === 'expired@example.com'), true)
  assert.equal((await downgrade.runExpiredDowngrades()).length, 0)
  assert.equal((await sql`SELECT plan FROM accounts WHERE id = ${expiredAccountId}`)[0].plan, 'free')
  assert.equal((await sql`SELECT status FROM licenses WHERE order_id = ${expiredOrder[0].id}`)[0].status, 'expired')
  console.log('PASS expired paid period downgrade lifecycle')
}

try {
  await run()
  console.log('\nM1.5 database integration passed.')
} finally {
  if (sql) await sql.end({ timeout: 1 }).catch(() => undefined)
  if (existsSync(buildDir)) rmSync(buildDir, { recursive: true, force: true })
  assert.match(schema, /^formalert_m15_test_[0-9a-f]+$/)
  await admin.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => undefined)
  await admin.end({ timeout: 1 }).catch(() => undefined)
}
