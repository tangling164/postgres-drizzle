import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import postgres from 'postgres'

const root = resolve(import.meta.dirname, '..')
const command = process.argv[2] ?? 'preflight'

function read(path) {
  return readFileSync(resolve(root, path), 'utf8')
}

function pass(message) {
  console.log(`PASS ${message}`)
}

function requireMatch(path, pattern, message) {
  assert.match(read(path), pattern, `${message} (${path})`)
  pass(message)
}

function requireNoMatch(path, pattern, message) {
  assert.doesNotMatch(read(path), pattern, `${message} (${path})`)
  pass(message)
}

function preflight() {
  requireMatch('components/site/pricing.tsx', /comingSoon: true/, 'Business is marked Coming soon')
  requireNoMatch('components/site/config.ts', /businessMonthly|businessYearly/, 'Business has no public checkout configuration')
  requireMatch('components/site/config.ts', /publicCreemCheckoutUrl/, 'Standard checkout rejects missing or Test-mode URLs')
  requireNoMatch('components/site/config.ts', /\/checkout\/success\?plan=/, 'Checkout configuration cannot fall back to the success page')
  requireNoMatch('components/site/pricing.tsx', /\$8|\$79|Up to 100 connected Google Forms/, 'Business price and detailed specification are not public')
  requireMatch('components/site/faq.tsx', /Free does not include Filter Rules/, 'Public FAQ states that Free has no Filter Rules')
  requireNoMatch('components/site/pricing.tsx', /Priority support|Unlimited Slack sends/, 'Unsupported public promises are removed')

  requireMatch('apps-script/LicenseService.gs', /free: \{[^}]*maxConditions: 0/, 'Free Filter Rules are disabled in the add-on')
  requireMatch('apps-script/LicenseService.gs', /standard: \{[^}]*maxForms: 20/, 'Standard is limited to 20 connected Forms')
  requireMatch('apps-script/Code.gs', /sendTestApi[\s\S]*prepareTestNotification_\(notification, true\)/, 'Quick Test enforces plan features')
  requireMatch('apps-script/BackendService.gs', /\/v2\/account\/test\/authorize/, 'Test sends use account-level authorization')
  requireMatch('app/v2/account/test/authorize/route.ts', /effectivePlan === 'none'/, 'Expired trials cannot use Test sends')
  requireMatch('apps-script/BackendService.gs', /\/v2\/account\/send\/reserve/, 'Formal sends use account-level quota reservation')
  requireMatch('apps-script/LicenseService.gs', /FREE_SEND_USED/, 'Free usage is cached at user scope')
  requireMatch('lib/backend/send-quota.ts', /DELETE FROM send_reservations/, 'Released Free reservations do not accumulate')

  requireMatch('apps-script/NotificationService.gs', /a\.createdAt \|\| a\.updatedAt/, 'Downgrade retention is deterministic by creation time')
  requireMatch('apps-script/Sidebar.html', /Paused by plan limit/, 'Plan-blocked Forms are visible in the add-on')
  requireMatch('apps-script/ExecutionService.gs', /message: 'Paused by plan limit\.'/ , 'Plan-blocked executions are explicit')

  assert.equal(existsSync(resolve(root, 'lib/db/migrations/0005_webhook_event_idempotency.sql')), true)
  pass('Webhook event idempotency migration exists')
  assert.equal(existsSync(resolve(root, 'lib/db/migrations/0006_unique_license_subscription.sql')), true)
  pass('One-license-per-subscription migration exists')
  assert.equal(existsSync(resolve(root, 'lib/db/migrations/0007_creem_order_aliases.sql')), true)
  pass('Out-of-order Creem order alias migration exists')
  requireMatch('app/api/webhooks/creem/route.ts', /claimWebhookEvent/, 'Creem Webhooks claim provider events before side effects')
  requireMatch('app/api/webhooks/creem/route.ts', /claim\.status === 'processing'[\s\S]*status: 503/, 'Concurrent Creem deliveries remain retryable')
  requireMatch('lib/backend/creem-handlers.ts', /Business sales are not enabled/, 'Business purchase fulfillment is disabled')
  requireMatch('lib/backend/creem-handlers.ts', /GREATEST\(COALESCE\(valid_until/, 'Out-of-order renewals cannot shorten paid access')
  requireMatch('lib/backend/downgrade.ts', /a\.plan_expires_at IS DISTINCT FROM l\.valid_until/, 'Downgrade reconciles the authoritative active license')
  requireMatch('apps-script/DebugService.gs', /standardReadiness/, 'Runtime readiness snapshot is available')
  requireMatch('apps-script/DebugService.gs', /planSyncedAt/, 'Runtime snapshot proves recent entitlement sync')
  requireMatch('apps-script/TriggerService.gs', /enabledForms/, 'Runtime readiness requires enabled Form alerts')

  const capturedAt = '2026-06-14T12:00:00.000Z'
  const validSnapshot = {
    capturedAt,
    planSyncedAt: capturedAt,
    appVersion: '1.8.0-m15-readiness',
    plan: 'standard',
    standardReadiness: {
      configuredForms: 20,
      enabledForms: 20,
      entitledForms: 20,
      planBlockedForms: 0,
      activeTriggerForms: 20,
      duplicateTriggers: 0,
      orphanTriggers: 0,
    },
  }
  assert.doesNotThrow(() => verifyRuntimeSnapshotData(validSnapshot))
  assert.throws(() =>
    verifyRuntimeSnapshotData({
      ...validSnapshot,
      standardReadiness: { ...validSnapshot.standardReadiness, enabledForms: 19 },
    })
  )
  assert.throws(() =>
    verifyRuntimeSnapshotData({
      ...validSnapshot,
      planSyncedAt: '2026-06-14T11:00:00.000Z',
    })
  )
  pass('Runtime certification verifier rejects disabled Forms and stale entitlement sync')

  console.log('\nM1.5 code preflight passed. Runtime certification is still required before Standard launch.')
}

function arg(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : null
}

function loadEnv() {
  const values = { ...process.env }
  const envPath = resolve(root, '.env')
  if (!existsSync(envPath)) return values
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
    if (!values[key]) values[key] = value
  }
  return values
}

function requireHttpsUrl(value, name) {
  if (!value) throw new Error(`${name} is required`)
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${name} must be a valid URL`)
  }
  if (url.protocol !== 'https:') throw new Error(`${name} must use HTTPS`)
  return url
}

function requireLiveCreemUrl(value, name) {
  const url = requireHttpsUrl(value, name)
  if (!(url.hostname === 'creem.io' || url.hostname.endsWith('.creem.io'))) {
    throw new Error(`${name} must use a Creem checkout URL`)
  }
  if (url.hostname.startsWith('test.') || url.pathname.includes('/test/')) {
    throw new Error(`${name} must not use Creem Test mode`)
  }
  return url.toString()
}

function requirePostgresUrl(value, name) {
  if (!value) throw new Error(`${name} is required`)
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${name} must be a valid Postgres URL`)
  }
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new Error(`${name} must use postgres:// or postgresql://`)
  }
  if (!url.hostname || !url.pathname || url.pathname === '/') {
    throw new Error(`${name} must identify a database`)
  }
  return url
}

function databaseTarget(url) {
  const host = url.hostname.toLowerCase().replace(/-pooler(?=\.)/, '')
  return `${host}${url.pathname.toLowerCase()}`
}

function creemProductId(env, directKey, checkoutUrl) {
  const direct = env[directKey]?.trim()
  if (direct) return direct
  return checkoutUrl?.match(/prod_[A-Za-z0-9]+/)?.[0] ?? null
}

function verifyLiveConfig() {
  const env = loadEnv()
  const errors = []
  const collect = (callback) => {
    try {
      return callback()
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
      return null
    }
  }
  const required = [
    'CREEM_WEBHOOK_SECRET',
    'LICENSE_PEPPER',
    'RESEND_API_KEY',
    'RESEND_FROM_EMAIL',
    'CRON_SECRET',
    'CP_OIDC_AUDIENCE',
    'DATABASE_URL',
    'POSTGRES_URL_NON_POOLING',
    'NEXT_PUBLIC_SUPPORT_EMAIL',
    'SUPPORT_EMAIL',
  ]
  for (const name of required) {
    if (!env[name]) errors.push(`${name} is required for Live sale`)
  }
  for (const name of [
    'CREEM_PRODUCT_BUSINESS_MONTHLY',
    'CREEM_PRODUCT_BUSINESS_YEARLY',
    'NEXT_PUBLIC_CREEM_BUSINESS_MONTHLY_URL',
    'NEXT_PUBLIC_CREEM_BUSINESS_YEARLY_URL',
  ]) {
    if (env[name]) errors.push(`${name} must be removed while Business is Coming soon`)
  }
  if (env.ENABLE_BUSINESS_SALES === 'true') {
    errors.push('ENABLE_BUSINESS_SALES must not be enabled while Business is Coming soon')
  }

  collect(() => requireHttpsUrl(env.NEXT_PUBLIC_SITE_URL, 'NEXT_PUBLIC_SITE_URL'))
  const marketplace = collect(() =>
    requireHttpsUrl(env.NEXT_PUBLIC_MARKETPLACE_URL, 'NEXT_PUBLIC_MARKETPLACE_URL')
  )
  if (marketplace && marketplace.hostname !== 'workspace.google.com') {
    errors.push('NEXT_PUBLIC_MARKETPLACE_URL must use the Google Workspace Marketplace')
  }
  const monthly = collect(() =>
    requireLiveCreemUrl(
      env.NEXT_PUBLIC_CREEM_STANDARD_MONTHLY_URL,
      'NEXT_PUBLIC_CREEM_STANDARD_MONTHLY_URL'
    )
  )
  const yearly = collect(() =>
    requireLiveCreemUrl(
      env.NEXT_PUBLIC_CREEM_STANDARD_YEARLY_URL,
      'NEXT_PUBLIC_CREEM_STANDARD_YEARLY_URL'
    )
  )
  if (monthly && yearly && monthly === yearly) {
    errors.push('Standard Monthly and Yearly must use different Checkout URLs')
  }
  const monthlyProduct = creemProductId(env, 'CREEM_PRODUCT_STANDARD_MONTHLY', monthly)
  const yearlyProduct = creemProductId(env, 'CREEM_PRODUCT_STANDARD_YEARLY', yearly)
  if (!monthlyProduct || !/^prod_[A-Za-z0-9]+$/.test(monthlyProduct)) {
    errors.push('Standard Monthly must expose a valid Creem product ID')
  }
  if (!yearlyProduct || !/^prod_[A-Za-z0-9]+$/.test(yearlyProduct)) {
    errors.push('Standard Yearly must expose a valid Creem product ID')
  }
  if (monthlyProduct && yearlyProduct && monthlyProduct === yearlyProduct) {
    errors.push('Standard Monthly and Yearly must use different Creem product IDs')
  }

  const pooledDatabase = collect(() => requirePostgresUrl(env.DATABASE_URL, 'DATABASE_URL'))
  const directDatabase = collect(() =>
    requirePostgresUrl(env.POSTGRES_URL_NON_POOLING, 'POSTGRES_URL_NON_POOLING')
  )
  if (directDatabase?.hostname.toLowerCase().includes('-pooler.')) {
    errors.push('POSTGRES_URL_NON_POOLING must use a direct, non-pooled database host')
  }
  if (
    pooledDatabase &&
    directDatabase &&
    databaseTarget(pooledDatabase) !== databaseTarget(directDatabase)
  ) {
    errors.push('DATABASE_URL and POSTGRES_URL_NON_POOLING must target the same database')
  }
  if (
    env.CP_OIDC_AUDIENCE &&
    !env.CP_OIDC_AUDIENCE.endsWith('.apps.googleusercontent.com')
  ) {
    errors.push('CP_OIDC_AUDIENCE must be a Google OAuth client audience')
  }
  if (errors.length) {
    assert.fail(`Live sale configuration is incomplete:\n- ${errors.join('\n- ')}`)
  }
  console.log('PASS Live sale configuration is complete and uses non-Test Standard Checkout URLs')
}

function verifyRuntimeSnapshotData(snapshot) {
  const readiness = snapshot.standardReadiness
  assert.ok(readiness, 'Snapshot is missing standardReadiness')
  assert.equal(snapshot.plan, 'standard', 'Runtime plan must be Standard')
  assert.match(snapshot.appVersion, /^1\.8\./, 'Runtime must use the M1.5 Apps Script build')
  const capturedAt = new Date(snapshot.capturedAt).getTime()
  const planSyncedAt = new Date(snapshot.planSyncedAt).getTime()
  assert.ok(Number.isFinite(capturedAt), 'Runtime snapshot must include capturedAt')
  assert.ok(Number.isFinite(planSyncedAt), 'Runtime snapshot must include planSyncedAt')
  assert.ok(
    planSyncedAt <= capturedAt && capturedAt - planSyncedAt <= 5 * 60 * 1000,
    'Runtime Standard plan must be synchronized within five minutes of the snapshot'
  )
  assert.equal(readiness.configuredForms, 20, 'Standard runtime must have exactly 20 configured Forms')
  assert.equal(readiness.enabledForms, 20, 'All 20 Standard Form alerts must be enabled')
  assert.equal(readiness.entitledForms, 20, 'All 20 Forms must be entitled')
  assert.equal(readiness.planBlockedForms, 0, 'No Standard Form may be plan-blocked')
  assert.equal(readiness.activeTriggerForms, 20, 'All 20 Forms must have an active trigger')
  assert.equal(readiness.duplicateTriggers, 0, 'No duplicate triggers are allowed')
  assert.equal(readiness.orphanTriggers, 0, 'No orphan triggers are allowed')
}

function verifyRuntimeSnapshot(snapshotPath) {
  const absolutePath = resolve(snapshotPath)
  assert.ok(existsSync(absolutePath), `Runtime snapshot not found: ${snapshotPath}`)
  const snapshot = JSON.parse(readFileSync(absolutePath, 'utf8'))
  verifyRuntimeSnapshotData(snapshot)
  console.log('PASS Standard 20-Form runtime certification snapshot')
}

function verifyRuntime() {
  const snapshotPath = arg('--snapshot')
  assert.ok(snapshotPath, 'Usage: pnpm test:m15 -- verify-runtime --snapshot <debug-info.json>')
  verifyRuntimeSnapshot(snapshotPath)
}

function verifyCheckout(checkout, cycle) {
  assert.ok(checkout, `Standard ${cycle} checkout evidence is missing`)
  assert.equal(checkout.mode, 'live', `Standard ${cycle} must use Live checkout`)
  assert.equal(checkout.licenseEmailDelivered, true, `Standard ${cycle} License Code email must be delivered`)
  assert.equal(checkout.officialLicenseCodeFormatVerified, true, `Standard ${cycle} must deliver an official License Code`)
  assert.equal(checkout.activatedPlan, 'standard', `Standard ${cycle} must activate Standard`)
  assert.equal(checkout.activatedBillingCycle, cycle, `Standard ${cycle} must activate the matching billing cycle`)
  assert.equal(
    checkout.displayLabel,
    `Standard / ${cycle.charAt(0).toUpperCase()}${cycle.slice(1)}`,
    `Standard ${cycle} must show the complete plan label`
  )
}

function verifyLaunchEvidence() {
  const evidencePath = arg('--evidence')
  assert.ok(evidencePath, 'Usage: pnpm test:m15 -- verify-launch-evidence --evidence <evidence.json>')
  const evidence = JSON.parse(readFileSync(resolve(evidencePath), 'utf8'))
  assert.equal(evidence.schemaVersion, 1, 'Launch evidence schemaVersion must be 1')
  assert.ok(evidence.runtimeSnapshot, 'Launch evidence must reference a runtime snapshot')
  verifyRuntimeSnapshot(evidence.runtimeSnapshot)

  verifyCheckout(evidence.checkouts?.standardMonthly, 'monthly')
  verifyCheckout(evidence.checkouts?.standardYearly, 'yearly')

  assert.equal(evidence.freeFilter?.createBlocked, true, 'Free must block creating Filter Rules')
  assert.equal(evidence.freeFilter?.saveBlocked, true, 'Free must block saving Filter Rules')
  assert.equal(evidence.freeFilter?.testBlocked, true, 'Free must block testing Filter Rules')

  assert.equal(evidence.downgrade?.pausedByPlanLimitVisible, true, 'Downgrade must show Paused by plan limit')
  assert.equal(evidence.downgrade?.settingsRetained, true, 'Downgrade must retain saved settings')
  assert.equal(evidence.downgrade?.upgradeRestored, true, 'Standard reactivation must restore eligibility')

  const soak = evidence.soak
  assert.ok(soak, '24-hour soak evidence is missing')
  const durationHours =
    (new Date(soak.endedAt).getTime() - new Date(soak.startedAt).getTime()) /
    (60 * 60 * 1000)
  assert.ok(Number.isFinite(durationHours) && durationHours >= 24, 'Standard soak must run for at least 24 hours')
  assert.equal(soak.formsTested, 20, 'Soak must cover all 20 Standard Forms')
  assert.ok(soak.expectedMatchingSends >= 20, 'Soak must expect at least one matching send per Form')
  assert.equal(soak.receivedMatchingSends, soak.expectedMatchingSends, 'Soak matching send count must be complete')
  assert.equal(soak.missingSends, 0, 'Soak must have zero missing sends')
  assert.equal(soak.duplicateSends, 0, 'Soak must have zero duplicate sends')
  assert.equal(soak.unexpectedNonMatchingSends, 0, 'Non-matching submissions must send nothing')
  console.log('PASS Standard Live checkout, downgrade, Free Filter, and 24-hour launch evidence')
}

async function verifyProductionDatabase() {
  const env = loadEnv()
  const directUrl = requirePostgresUrl(
    env.POSTGRES_URL_NON_POOLING,
    'POSTGRES_URL_NON_POOLING'
  )
  assert.equal(
    directUrl.hostname.toLowerCase().includes('-pooler.'),
    false,
    'Production database verification requires a direct, non-pooled URL'
  )

  const sql = postgres(directUrl.toString(), {
    ssl: 'require',
    max: 1,
    prepare: false,
  })
  try {
    const requiredMigrations = readdirSync(resolve(root, 'lib/db/migrations'))
      .filter((name) => name.endsWith('.sql'))
      .sort()
    const appliedRows = await sql`SELECT name FROM schema_migrations`
    const applied = new Set(appliedRows.map((row) => String(row.name)))
    const missingMigrations = requiredMigrations.filter((name) => !applied.has(name))

    const duplicateSubscriptions = Number(
      (
        await sql`
          SELECT count(*) AS count
          FROM (
            SELECT creem_subscription_id
            FROM licenses
            WHERE creem_subscription_id IS NOT NULL
              AND status IN ('pending', 'active')
            GROUP BY creem_subscription_id
            HAVING count(*) > 1
          ) duplicates
        `
      )[0].count
    )
    const openBusinessLicenses = Number(
      (
        await sql`
          SELECT count(*) AS count
          FROM licenses
          WHERE plan = 'business' AND status IN ('pending', 'active')
        `
      )[0].count
    )
    const preCutoverOpenLicenses = Number(
      (
        await sql`
          SELECT count(*) AS count
          FROM licenses
          WHERE created_at < timestamptz '2026-06-14 04:00:00+00'
            AND status IN ('pending', 'active')
        `
      )[0].count
    )
    const activeLicenseDrift = Number(
      (
        await sql`
          SELECT count(*) AS count
          FROM licenses l
          JOIN accounts a ON a.id = l.activated_account_id
          WHERE l.status = 'active'
            AND (
              a.plan <> l.plan
              OR a.plan_expires_at IS DISTINCT FROM l.valid_until
              OR a.status <> 'active'
            )
        `
      )[0].count
    )

    const errors = []
    if (missingMigrations.length > 0) {
      errors.push(`missing migrations: ${missingMigrations.join(', ')}`)
    }
    if (duplicateSubscriptions > 0) {
      errors.push(`${duplicateSubscriptions} duplicate Creem subscription group(s)`)
    }
    if (openBusinessLicenses > 0) {
      errors.push(`${openBusinessLicenses} pending/active Business license(s)`)
    }
    if (preCutoverOpenLicenses > 0) {
      errors.push(`${preCutoverOpenLicenses} pre-cutover pending/active license(s)`)
    }
    if (activeLicenseDrift > 0) {
      errors.push(`${activeLicenseDrift} active license/account cache mismatch(es)`)
    }
    if (errors.length > 0) {
      assert.fail(`Production database is not ready for Standard sale:\n- ${errors.join('\n- ')}`)
    }
    console.log('PASS Production database migrations and Standard-only license state')
  } finally {
    await sql.end({ timeout: 1 })
  }
}

if (command === 'preflight') preflight()
else if (command === 'verify-runtime') verifyRuntime()
else if (command === 'verify-live-config') verifyLiveConfig()
else if (command === 'verify-launch-evidence') verifyLaunchEvidence()
else if (command === 'verify-production-database') await verifyProductionDatabase()
else throw new Error(`Unknown command: ${command}`)
