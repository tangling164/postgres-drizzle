/**
 * Production M1 paid-loop acceptance runner.
 *
 * The runner verifies the real Creem-created order/license rows before and
 * after a human-triggered activation inside the real Google Forms add-on.
 *
 * License Codes are accepted only through M1_LICENSE_CODE or --code and are
 * never printed or written to disk.
 */
import { createHmac } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
loadEnvFile()

const args = parseArgs(process.argv.slice(2))
const command = args._[0] ?? 'help'
const officialPattern =
  /^FA-([SB])-(?:[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}-){3}[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/

function loadEnvFile() {
  const envPath = join(repoRoot, '.env')
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

function parseArgs(values) {
  const parsed = { _: [] }
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    if (!value.startsWith('--')) {
      parsed._.push(value)
      continue
    }
    const [rawKey, inlineValue] = value.slice(2).split('=', 2)
    if (inlineValue !== undefined) {
      parsed[rawKey] = inlineValue
    } else if (values[index + 1] && !values[index + 1].startsWith('--')) {
      parsed[rawKey] = values[index + 1]
      index += 1
    } else {
      parsed[rawKey] = true
    }
  }
  return parsed
}

function requireValue(value, name) {
  if (!value || value === true) throw new Error(`Missing ${name}`)
  return String(value).trim()
}

function normalizedPlan() {
  const plan = requireValue(args.plan, '--plan').toLowerCase()
  if (plan !== 'standard' && plan !== 'business') {
    throw new Error('--plan must be standard or business')
  }
  return plan
}

function normalizedCycle() {
  const cycle = requireValue(args.cycle, '--cycle').toLowerCase()
  if (cycle !== 'monthly' && cycle !== 'yearly') {
    throw new Error('--cycle must be monthly or yearly')
  }
  return cycle
}

function databaseUrl() {
  const value =
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL
  if (!value) throw new Error('Database URL is not configured')
  return value
}

function licensePepper() {
  const value = process.env.LICENSE_PEPPER
  if (!value) throw new Error('LICENSE_PEPPER is not configured')
  return value
}

function resendApiKey() {
  const value = process.env.RESEND_API_KEY
  if (!value) throw new Error('RESEND_API_KEY is not configured')
  return value
}

async function retrieveResendEmail(emailId) {
  const response = await fetch(`https://api.resend.com/emails/${emailId}`, {
    headers: { Authorization: `Bearer ${resendApiKey()}` },
  })
  assert(response.ok, `Resend email lookup returned HTTP ${response.status}`)
  return response.json()
}

function hashLicenseCode(code) {
  return createHmac('sha256', licensePepper())
    .update(code.trim().toUpperCase())
    .digest('hex')
}

function redactEmail(email) {
  const [local, domain] = String(email).split('@')
  if (!domain) return '[redacted]'
  return `${local.slice(0, 2)}***@${domain}`
}

function statePath(plan, cycle) {
  return join(repoRoot, 'temp', `m1-acceptance-${plan}-${cycle}.json`)
}

function reportPath(plan, cycle) {
  return join(repoRoot, 'temp', `m1-acceptance-${plan}-${cycle}-report.json`)
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function checkoutUrl(plan, cycle) {
  const key = `NEXT_PUBLIC_CREEM_${plan.toUpperCase()}_${cycle.toUpperCase()}_URL`
  const value = process.env[key]
  if (!value) throw new Error(`${key} is not configured`)
  return value
}

function assertPaidPeriod(cycle, validUntil) {
  const daysRemaining =
    (new Date(validUntil).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
  const [minimum, maximum] = cycle === 'yearly' ? [300, 400] : [20, 45]
  assert(
    daysRemaining >= minimum && daysRemaining <= maximum,
    `${cycle} paid period has ${daysRemaining.toFixed(1)} days remaining, expected ${minimum}-${maximum}`
  )
  return Number(daysRemaining.toFixed(1))
}

async function preflight() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  assert(siteUrl, 'NEXT_PUBLIC_SITE_URL is not configured')
  const sql = postgres(databaseUrl(), {
    ssl: 'require',
    max: 1,
    prepare: false,
    connect_timeout: 10,
  })
  try {
    const [migration] = await sql`
      SELECT EXISTS (
        SELECT 1 FROM schema_migrations
        WHERE name = '0002_retire_pre_cutover_test_licenses.sql'
      ) AS applied
    `
    const legacy = await sql`
      SELECT status, count(*)::int AS count
      FROM licenses
      WHERE created_at < timestamptz '2026-06-14 04:00:00+00'
      GROUP BY status
      ORDER BY status
    `
    assert(migration.applied, 'Test-license retirement migration is not applied')
    assert(
      legacy.every((row) => row.status === 'revoked'),
      'A pre-cutover Test license is still usable'
    )

    const legacyProbe = await fetch(
      `${siteUrl}/api/license/check?code=STANDARD-TEST`
    )
    assert(legacyProbe.ok, `Legacy-code probe returned HTTP ${legacyProbe.status}`)
    const legacyBody = await legacyProbe.json()
    assert(legacyBody.usable === false, 'STANDARD-TEST is still usable')

    console.log('M1 preflight passed.')
    console.log(`Standard Monthly Test checkout: ${checkoutUrl('standard', 'monthly')}`)
    console.log(`Standard Yearly Test checkout: ${checkoutUrl('standard', 'yearly')}`)
    console.log(`Business Monthly Test checkout: ${checkoutUrl('business', 'monthly')}`)
    console.log(`Business Yearly Test checkout: ${checkoutUrl('business', 'yearly')}`)
    console.log(`Retired pre-cutover licenses: ${JSON.stringify(legacy)}`)
  } finally {
    await sql.end({ timeout: 5 })
  }
}

async function observePurchase() {
  const plan = normalizedPlan()
  const cycle = normalizedCycle()
  const email = requireValue(args.email, '--email').toLowerCase()
  const sql = postgres(databaseUrl(), {
    ssl: 'require',
    max: 1,
    prepare: false,
    connect_timeout: 10,
  })
  try {
    const rows = await sql`
      SELECT o.id AS order_id, o.creem_order_id, o.plan, o.billing_cycle,
             o.status AS order_status, o.license_email_sent_at,
             o.license_email_id, o.license_email_status, o.created_at,
             l.id AS license_id, l.status AS license_status, l.valid_until
      FROM orders o
      JOIN licenses l ON l.order_id = o.id
      WHERE lower(o.buyer_email) = ${email}
        AND o.plan = ${plan}
        AND o.billing_cycle = ${cycle}
      ORDER BY o.created_at DESC
      LIMIT 1
    `
    assert(rows.length === 1, `No ${plan} ${cycle} purchase found for ${redactEmail(email)}`)
    const purchase = rows[0]
    assert(purchase.order_status === 'completed', 'Order is not completed')
    assert(purchase.license_email_sent_at, 'License email has not been sent')
    assert(purchase.license_email_id, 'Resend email ID is missing')
    const delivery = await retrieveResendEmail(purchase.license_email_id)
    await sql`
      UPDATE orders SET license_email_status = ${delivery.last_event}, updated_at = now()
      WHERE id = ${purchase.order_id}
    `
    assert(
      delivery.last_event === 'delivered',
      `Resend final event is ${delivery.last_event}, expected delivered`
    )
    assert(
      purchase.license_status === 'pending',
      `License status is ${purchase.license_status}, expected pending before activation`
    )
    const paidPeriodDaysRemaining = assertPaidPeriod(cycle, purchase.valid_until)
    const state = {
      status: 'purchase_observed',
      plan,
      billingCycle: cycle,
      buyer: redactEmail(email),
      orderId: purchase.creem_order_id,
      internalOrderId: purchase.order_id,
      licenseId: purchase.license_id,
      orderStatus: purchase.order_status,
      licenseStatus: purchase.license_status,
      emailSentAt: purchase.license_email_sent_at,
      emailProviderStatus: delivery.last_event,
      validUntil: purchase.valid_until,
      paidPeriodDaysRemaining,
      observedAt: new Date().toISOString(),
    }
    writeJson(statePath(plan, cycle), state)
    console.log(JSON.stringify(state, null, 2))
    console.log(`Snapshot written: ${statePath(plan, cycle)}`)
  } finally {
    await sql.end({ timeout: 5 })
  }
}

function paidFeatureContract(plan) {
  const source = readFileSync(join(repoRoot, 'apps-script', 'LicenseService.gs'), 'utf8')
  const maxForms = plan === 'business' ? 100 : 20
  const pattern = new RegExp(
    `${plan}: \\{ plan: '${plan}', label: '[^']+', maxForms: ${maxForms}, maxNotifications: ${maxForms}, maxConditions: 50, allowsPayload: true`
  )
  assert(pattern.test(source), `Apps Script ${plan} feature contract does not match M1`)
  return { maxForms, maxConditions: 50, allowsPayload: true, unlimitedSends: true }
}

async function verifyActivatedPurchase() {
  const plan = normalizedPlan()
  const cycle = normalizedCycle()
  const email = requireValue(args.email, '--email').toLowerCase()
  const code = requireValue(args.code ?? process.env.M1_LICENSE_CODE, '--code or M1_LICENSE_CODE')
    .toUpperCase()
  const format = code.match(officialPattern)
  assert(format, 'License Code is not an official email-delivered format')
  assert(
    format[1] === (plan === 'standard' ? 'S' : 'B'),
    `License Code prefix does not match ${plan}`
  )

  const sql = postgres(databaseUrl(), {
    ssl: 'require',
    max: 1,
    prepare: false,
    connect_timeout: 10,
  })
  try {
    const codeHash = hashLicenseCode(code)
    const beforeRows = await sql`
      SELECT l.id AS license_id, l.plan, l.status AS license_status,
             l.valid_until, l.activated_account_id,
             o.creem_order_id, o.status AS order_status, o.buyer_email, o.billing_cycle,
             o.license_email_sent_at, o.license_email_id, o.license_email_status
      FROM licenses l
      JOIN orders o ON o.id = l.order_id
      WHERE l.code_hash = ${codeHash}
      LIMIT 1
    `
    assert(beforeRows.length === 1, 'License Code was not generated by the production purchase flow')
    const before = beforeRows[0]
    assert(before.plan === plan, `Database license plan is ${before.plan}, expected ${plan}`)
    assert(
      before.billing_cycle === cycle,
      `Database billing cycle is ${before.billing_cycle}, expected ${cycle}`
    )
    assert(
      String(before.buyer_email).toLowerCase() === email,
      'Purchase email does not match --email'
    )
    assert(before.order_status === 'completed', 'Creem order is not completed')
    assert(before.license_email_sent_at, 'Resend delivery marker is missing')
    assert(before.license_email_id, 'Resend email ID is missing')
    const delivery = await retrieveResendEmail(before.license_email_id)
    assert(delivery.last_event === 'delivered', `Resend final event is ${delivery.last_event}`)
    assert(
      existsSync(statePath(plan, cycle)),
      `Run observe before activating the ${plan} ${cycle} License Code`
    )
    const snapshot = JSON.parse(readFileSync(statePath(plan, cycle), 'utf8'))
    assert(snapshot.licenseId === before.license_id, 'Observed purchase and supplied License Code do not match')
    assert(snapshot.licenseStatus === 'pending', 'Observed snapshot was not captured before activation')
    assert(snapshot.billingCycle === cycle, 'Observed snapshot billing cycle does not match')

    const afterRows = await sql`
      SELECT l.id AS license_id, l.plan, l.status AS license_status,
             l.valid_until, l.activated_account_id,
             a.plan AS account_plan, a.plan_expires_at,
             a.entitlement_status,
             (
               SELECT count(*)::int FROM licenses active
               WHERE active.activated_account_id = a.id AND active.status = 'active'
             ) AS active_license_count
      FROM licenses l
      JOIN accounts a ON a.id = l.activated_account_id
      WHERE l.code_hash = ${codeHash}
      LIMIT 1
    `
    assert(afterRows.length === 1, 'Activated license is not linked to an account')
    const after = afterRows[0]
    assert(after.license_status === 'active', 'License did not become active')
    assert(after.account_plan === plan, `Account plan is ${after.account_plan}, expected ${plan}`)
    assert(after.entitlement_status === 'active', 'Account entitlement is not active')
    assert(after.active_license_count === 1, 'Account does not have exactly one active license')
    assert(
      new Date(after.valid_until).getTime() === new Date(after.plan_expires_at).getTime(),
      'License and account expiry do not match'
    )
    const features = paidFeatureContract(plan)
    const expectedSupersededPlan = args['expect-upgrade']
      ? 'standard'
      : args['expect-superseded']
        ? requireValue(args['expect-superseded'], '--expect-superseded').toLowerCase()
        : null
    assert(
      !expectedSupersededPlan ||
        expectedSupersededPlan === 'standard' ||
        expectedSupersededPlan === 'business',
      '--expect-superseded must be standard or business'
    )
    let supersededLicenseCount = 0
    if (expectedSupersededPlan) {
      const [replacement] = await sql`
        SELECT count(*)::int AS count
        FROM licenses
        WHERE activated_account_id = ${after.activated_account_id}
          AND plan = ${expectedSupersededPlan}
          AND status = 'superseded'
      `
      supersededLicenseCount = replacement.count
      assert(
        supersededLicenseCount >= 1,
        `${plan} ${cycle} activation did not supersede the previous ${expectedSupersededPlan} license`
      )
    }
    const paidPeriodDaysRemaining = assertPaidPeriod(cycle, after.valid_until)

    const report = {
      status: 'm1_paid_loop_passed',
      plan,
      billingCycle: cycle,
      buyer: redactEmail(email),
      orderId: before.creem_order_id,
      observedLicenseStatus: snapshot.licenseStatus,
      licenseStatusAfterActivation: after.license_status,
      accountPlan: after.account_plan,
      entitlementStatus: after.entitlement_status,
      activeLicenseCount: after.active_license_count,
      expectedSupersededPlan,
      supersededLicenseCount,
      validUntil: after.valid_until,
      paidPeriodDaysRemaining,
      emailProviderStatus: delivery.last_event,
      paidFeatureContract: features,
      verifiedAt: new Date().toISOString(),
      assertions: [
        'Creem order completed',
        'Resend reports delivery accepted by the recipient mail server',
        'Official plan-prefixed License Code matched production hash',
        'License transitioned from pending to active after real add-on activation',
        'Database entitlement and active license agree',
        'Exactly one active license remains on the Google account',
        'Billing cycle maps to the expected paid period',
        'Purchased plan maps to the expected paid feature contract',
      ],
    }
    writeJson(reportPath(plan, cycle), report)
    console.log(JSON.stringify(report, null, 2))
    console.log(`Evidence written: ${reportPath(plan, cycle)}`)
  } finally {
    await sql.end({ timeout: 5 })
  }
}

function printHelp() {
  console.log(`Usage:
  pnpm test:m1 -- preflight
  pnpm test:m1 -- observe --plan standard|business --cycle monthly|yearly --email buyer@example.com
  pnpm test:m1 -- verify --plan standard|business --cycle monthly|yearly --email buyer@example.com --code <EMAIL_CODE> [--expect-superseded standard|business]

Run observe before pasting the code into the add-on. After activation, run verify.
The verify command never prints or stores the License Code.`)
}

try {
  if (command === 'preflight') await preflight()
  else if (command === 'observe') await observePurchase()
  else if (command === 'verify') await verifyActivatedPurchase()
  else printHelp()
} catch (error) {
  console.error(`M1 acceptance failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
