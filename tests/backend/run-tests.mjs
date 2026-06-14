/**
 * Backend pure-logic tests (Phase 1 license system).
 * Run: pnpm test:backend
 *
 * The lib/ modules are TypeScript with `@/` path aliases, so this runner
 * transpiles them on the fly with the project's own `typescript` package
 * (no extra test dependencies) into tests/backend/.build and requires the
 * CommonJS output. Only pure logic is tested here — DB-backed flows are
 * covered by the Phase 1 staging checklist in the spec (§10.0).
 */
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import ts from 'typescript'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..', '..')
const buildDir = join(here, '.build')

const SOURCES = [
  'lib/backend/plans.ts',
  'lib/backend/license.ts',
  'lib/backend/activation.ts',
  'lib/backend/entitlement.ts',
  'lib/backend/creem-catalog.ts',
  'lib/backend/creem.ts',
  'lib/backend/rate-limit.ts',
  'lib/db/client.ts',
]

rmSync(buildDir, { recursive: true, force: true })

for (const sourcePath of SOURCES) {
  const absolute = join(repoRoot, sourcePath)
  let code = readFileSync(absolute, 'utf8')
  // Rewrite `@/lib/...` aliases to relative imports for the build tree.
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

const requireBuilt = createRequire(join(buildDir, 'index.js'))
const license = requireBuilt('./lib/backend/license.js')
const plans = requireBuilt('./lib/backend/plans.js')
const activation = requireBuilt('./lib/backend/activation.js')
const entitlement = requireBuilt('./lib/backend/entitlement.js')
const creem = requireBuilt('./lib/backend/creem.js')
const rateLimit = requireBuilt('./lib/backend/rate-limit.js')

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    passed += 1
    console.log(`  ok    ${name}`)
  } catch (error) {
    failed += 1
    console.error(`  FAIL  ${name}`)
    console.error(`        ${error.message}`)
  }
}

const NOW = new Date('2026-06-12T12:00:00Z')
const FUTURE = new Date('2026-07-12T12:00:00Z')
const PAST = new Date('2026-06-01T12:00:00Z')

console.log('license.ts')

test('generated codes match the documented format', () => {
  for (const plan of ['standard', 'business']) {
    for (let i = 0; i < 25; i += 1) {
      const code = license.generateLicenseCode(plan)
      assert.match(code, license.LICENSE_CODE_PATTERN)
      assert.equal(code.startsWith(plan === 'business' ? 'FA-B-' : 'FA-S-'), true)
    }
  }
})

test('charset excludes ambiguous characters 0/O/1/I/L', () => {
  for (const char of '0O1IL') {
    assert.ok(!license.LICENSE_CHARSET.includes(char))
  }
})

test('format validation normalizes case and whitespace', () => {
  assert.equal(license.isValidLicenseCodeFormat(' fa-s-abcde-fghjk-mnpqr-stuvw '), true)
  assert.equal(license.isValidLicenseCodeFormat('FA-B-ABCDE-FGHJK-MNPQR-STUVW'), true)
  assert.equal(license.isValidLicenseCodeFormat('FA-ABCD-EFGH-JKMN-PQRS'), false)
  assert.equal(license.isValidLicenseCodeFormat('STANDARD-TEST'), false)
  assert.equal(license.isValidLicenseCodeFormat('BUSINESS-TEST'), false)
  assert.equal(license.isValidLicenseCodeFormat('FA-S-ABCDE-FGHJK'), false)
  assert.equal(license.isValidLicenseCodeFormat('FA-S-ABC0E-FGHJK-MNPQR-STUVW'), false)
  assert.equal(license.isValidLicenseCodeFormat(''), false)
})

test('hash is deterministic and pepper-sensitive', () => {
  const a = license.hashLicenseCode('FA-S-ABCDE-FGHJK-MNPQR-STUVW', 'pepper-1')
  const b = license.hashLicenseCode('fa-s-abcde-fghjk-mnpqr-stuvw', 'pepper-1')
  const c = license.hashLicenseCode('FA-S-ABCDE-FGHJK-MNPQR-STUVW', 'pepper-2')
  assert.equal(a, b)
  assert.notEqual(a, c)
  assert.throws(() => license.hashLicenseCode('FA-ABCD-EFGH-JKMN-PQRS', ''))
})

test('M1 transaction paths use the direct database connection', () => {
  for (const source of [
    'app/v2/license/activate/route.ts',
    'lib/backend/accounts.ts',
    'app/api/jobs/downgrade-expired/route.ts',
  ]) {
    const contents = readFileSync(join(repoRoot, source), 'utf8')
    assert.match(contents, /getSql\(\{ transaction: true \}\)/)
  }
})

test('timingSafeEqualHex compares correctly', () => {
  assert.equal(license.timingSafeEqualHex('abcd12', 'abcd12'), true)
  assert.equal(license.timingSafeEqualHex('abcd12', 'abcd13'), false)
  assert.equal(license.timingSafeEqualHex('abcd12', 'abcd'), false)
  assert.equal(license.timingSafeEqualHex('', ''), false)
})

console.log('plans.ts')

test('plan constants match spec §2.1 (confirmed 20/100)', () => {
  assert.equal(plans.PLAN_FORM_LIMITS.free, 1)
  assert.equal(plans.PLAN_FORM_LIMITS.standard, 20)
  assert.equal(plans.PLAN_FORM_LIMITS.business, 100)
  assert.deepEqual(plans.planFeatures('free'), [])
  assert.ok(plans.planFeatures('business').includes('custom_payload'))
})

console.log('activation.ts (§5.1 state machine)')

const baseAccount = {
  id: 'acc-1',
  plan: 'free',
  planExpiresAt: null,
  hasActiveLicense: false,
}

test('unknown code → 404 license_not_found', () => {
  const decision = activation.evaluateActivation(null, baseAccount, NOW)
  assert.deepEqual(decision, {
    kind: 'error',
    httpStatus: 404,
    error: 'license_not_found',
  })
})

test('active license on same account → already_active', () => {
  const decision = activation.evaluateActivation(
    { id: 'lic-1', plan: 'standard', status: 'active', activatedAccountId: 'acc-1', validUntil: FUTURE },
    baseAccount,
    NOW
  )
  assert.equal(decision.kind, 'already_active')
})

test('active license on another account → 409 license_already_used', () => {
  const decision = activation.evaluateActivation(
    { id: 'lic-1', plan: 'standard', status: 'active', activatedAccountId: 'acc-2', validUntil: FUTURE },
    baseAccount,
    NOW
  )
  assert.equal(decision.error, 'license_already_used')
  assert.equal(decision.httpStatus, 409)
})

test('revoked / superseded / expired → 410 license_revoked', () => {
  for (const status of ['revoked', 'superseded', 'expired']) {
    const decision = activation.evaluateActivation(
      { id: 'lic-1', plan: 'standard', status, activatedAccountId: null, validUntil: FUTURE },
      baseAccount,
      NOW
    )
    assert.equal(decision.error, 'license_revoked')
  }
})

test('pending license past its paid period → 410 license_expired (P1-03)', () => {
  const decision = activation.evaluateActivation(
    { id: 'lic-1', plan: 'standard', status: 'pending', activatedAccountId: null, validUntil: PAST },
    baseAccount,
    NOW
  )
  assert.equal(decision.error, 'license_expired')
})

test('standard code on valid business account → 409 lower_tier (§5.1 priority)', () => {
  const decision = activation.evaluateActivation(
    { id: 'lic-1', plan: 'standard', status: 'pending', activatedAccountId: null, validUntil: FUTURE },
    { id: 'acc-1', plan: 'business', planExpiresAt: FUTURE, hasActiveLicense: true },
    NOW
  )
  assert.equal(decision.error, 'lower_tier_license_not_allowed')
})

test('standard code allowed when business plan is only a stale cache (P1-01)', () => {
  const decision = activation.evaluateActivation(
    { id: 'lic-1', plan: 'standard', status: 'pending', activatedAccountId: null, validUntil: FUTURE },
    { id: 'acc-1', plan: 'business', planExpiresAt: FUTURE, hasActiveLicense: false },
    NOW
  )
  assert.equal(decision.kind, 'activate')
})

test('business code on standard account → upgrade allowed', () => {
  const decision = activation.evaluateActivation(
    { id: 'lic-1', plan: 'business', status: 'pending', activatedAccountId: null, validUntil: FUTURE },
    { id: 'acc-1', plan: 'standard', planExpiresAt: FUTURE, hasActiveLicense: true },
    NOW
  )
  assert.equal(decision.kind, 'activate')
  assert.equal(decision.plan, 'business')
  assert.equal(decision.validUntil, FUTURE)
})

console.log('entitlement.ts (§6.3 + P1-01)')

const activeTrial = {
  expiresAt: FUTURE,
  sendLimit: 30,
  sendUsed: 3,
  status: 'active',
}

test('paid plan with matching active license → paid_active', () => {
  const result = entitlement.resolveEntitlementFrom(
    {
      account: { plan: 'standard', planExpiresAt: FUTURE, entitlementStatus: 'active' },
      activeLicense: { plan: 'standard', validUntil: FUTURE, billingCycle: 'yearly' },
      trial: activeTrial,
    },
    NOW
  )
  assert.equal(result.effectivePlan, 'standard')
  assert.equal(result.reason, 'paid_active')
  assert.equal(result.billingCycle, 'yearly')
})

test('paid plan cache WITHOUT active license falls back to trial (P1-01)', () => {
  const result = entitlement.resolveEntitlementFrom(
    {
      account: { plan: 'business', planExpiresAt: FUTURE, entitlementStatus: 'active' },
      activeLicense: null,
      trial: activeTrial,
    },
    NOW
  )
  assert.equal(result.effectivePlan, 'free')
  assert.equal(result.reason, 'free_active')
})

test('revoked entitlement_status blocks paid access even with license row', () => {
  const result = entitlement.resolveEntitlementFrom(
    {
      account: { plan: 'standard', planExpiresAt: FUTURE, entitlementStatus: 'revoked' },
      activeLicense: { plan: 'standard', validUntil: FUTURE, billingCycle: 'monthly' },
      trial: null,
    },
    NOW
  )
  assert.equal(result.effectivePlan, 'none')
})

test('expired paid period falls back to trial state', () => {
  const result = entitlement.resolveEntitlementFrom(
    {
      account: { plan: 'standard', planExpiresAt: PAST, entitlementStatus: 'active' },
      activeLicense: { plan: 'standard', validUntil: PAST, billingCycle: 'monthly' },
      trial: { ...activeTrial, expiresAt: PAST },
    },
    NOW
  )
  assert.equal(result.effectivePlan, 'none')
  assert.equal(result.reason, 'free_trial_expired')
})

test('exhausted quota wins over expiry ordering', () => {
  const result = entitlement.resolveEntitlementFrom(
    {
      account: { plan: 'free', planExpiresAt: null, entitlementStatus: 'active' },
      activeLicense: null,
      trial: { expiresAt: FUTURE, sendLimit: 30, sendUsed: 30, status: 'active' },
    },
    NOW
  )
  assert.equal(result.reason, 'free_trial_exhausted')
})

test('no trial row → no_entitlement', () => {
  const result = entitlement.resolveEntitlementFrom(
    {
      account: { plan: 'free', planExpiresAt: null, entitlementStatus: 'active' },
      activeLicense: null,
      trial: null,
    },
    NOW
  )
  assert.equal(result.effectivePlan, 'none')
  assert.equal(result.reason, 'no_entitlement')
})

console.log('creem.ts (§4.2 / §4.5)')

test('signature verification round-trips and rejects tampering', () => {
  const body = '{"eventType":"checkout.completed"}'
  const signature = creem.computeCreemSignature(body, 'whsec_test')
  assert.equal(creem.verifyCreemSignature(body, signature, 'whsec_test'), true)
  assert.equal(creem.verifyCreemSignature(body + ' ', signature, 'whsec_test'), false)
  assert.equal(creem.verifyCreemSignature(body, signature, 'whsec_other'), false)
  assert.equal(creem.verifyCreemSignature(body, null, 'whsec_test'), false)
})

test('checkout.completed normalizes to a paid event', () => {
  const event = creem.normalizeCreemEvent({
    eventType: 'checkout.completed',
    object: {
      order: { id: 'ord_1', amount: 900, currency: 'USD' },
      subscription: {
        id: 'sub_1',
        current_period_end_date: '2026-07-12T00:00:00Z',
      },
      customer: { email: 'buyer@example.com' },
      metadata: { plan: 'standard', billing_cycle: 'monthly' },
    },
  })
  assert.equal(event.kind, 'paid')
  assert.equal(event.orderId, 'ord_1')
  assert.equal(event.subscriptionId, 'sub_1')
  assert.equal(event.plan, 'standard')
  assert.equal(event.billingCycle, 'monthly')
  assert.equal(event.periodEnd.toISOString(), '2026-07-12T00:00:00.000Z')
})

test('checkout.completed resolves plan from Creem product ID via checkout URL env', () => {
  process.env.NEXT_PUBLIC_CREEM_STANDARD_MONTHLY_URL =
    'https://www.creem.io/test/payment/prod_DQ9TuMZpyUZ6wRk4Hkks'
  const event = creem.normalizeCreemEvent({
    eventType: 'checkout.completed',
    object: {
      id: 'ch_checkout_id',
      order: { id: 'ord_creem', amount: 900, currency: 'USD' },
      subscription: { id: 'sub_creem' },
      customer: { email: 'buyer@example.com' },
      product: {
        id: 'prod_DQ9TuMZpyUZ6wRk4Hkks',
        name: 'Monthly',
        billing_period: 'every-month',
      },
    },
  })
  assert.equal(event.kind, 'paid')
  assert.equal(event.plan, 'standard')
  assert.equal(event.billingCycle, 'monthly')
  delete process.env.NEXT_PUBLIC_CREEM_STANDARD_MONTHLY_URL
})

test('plan falls back to product name parsing', () => {
  const event = creem.normalizeCreemEvent({
    eventType: 'checkout.completed',
    object: {
      order: { id: 'ord_2' },
      customer: { email: 'b@example.com' },
      product: { name: 'FormAlert Business (Yearly)', billing_period: 'every-year' },
    },
  })
  assert.equal(event.plan, 'business')
  assert.equal(event.billingCycle, 'yearly')
})

test('paid event with missing plan throws CreemPayloadError', () => {
  assert.throws(
    () =>
      creem.normalizeCreemEvent({
        eventType: 'checkout.completed',
        object: { order: { id: 'ord_3' }, customer: { email: 'x@example.com' } },
      }),
    /cannot resolve plan/
  )
})

test('official Creem checkout.completed sample (Monthly + product ID catalog)', () => {
  process.env.CREEM_PRODUCT_STANDARD_MONTHLY = 'prod_d1AY2Sadk9YAvLI0pj97f'
  const event = creem.normalizeCreemEvent({
    id: 'evt_5WHHcZPv7VS0YUsberIuOz',
    eventType: 'checkout.completed',
    object: {
      id: 'ch_4l0N34kxo16AhRKUHFUuXr',
      object: 'checkout',
      order: { id: 'ord_4aDwWXjMLpes4Kj4XqNnUA', amount: 1000, currency: 'EUR' },
      subscription: { id: 'sub_6pC2lNB6joCRQIZ1aMrTpi' },
      customer: { email: 'customer@example.com' },
      product: {
        id: 'prod_d1AY2Sadk9YAvLI0pj97f',
        name: 'Monthly',
        billing_period: 'every-month',
      },
    },
  })
  assert.equal(event.kind, 'paid')
  assert.equal(event.plan, 'standard')
  assert.equal(event.billingCycle, 'monthly')
  delete process.env.CREEM_PRODUCT_STANDARD_MONTHLY
})

test('subscription.active is ignored (Creem sync-only event)', () => {
  const event = creem.normalizeCreemEvent({
    eventType: 'subscription.active',
    object: { id: 'sub_1', customer: { email: 'a@b.com' } },
  })
  assert.equal(event.kind, 'ignored')
  assert.equal(event.type, 'subscription.active')
})

test('subscription.paid normalizes with last_transaction_id as order key', () => {
  process.env.NEXT_PUBLIC_CREEM_BUSINESS_YEARLY_URL =
    'https://www.creem.io/test/payment/prod_1TYW5ZOi7pDT24Z1AvsoFs'
  const event = creem.normalizeCreemEvent({
    eventType: 'subscription.paid',
    object: {
      id: 'sub_renew',
      last_transaction_id: 'tran_abc',
      customer: { email: 'buyer@example.com' },
      product: {
        id: 'prod_1TYW5ZOi7pDT24Z1AvsoFs',
        name: 'Yearly',
        billing_period: 'every-year',
      },
      current_period_end_date: '2027-01-01T00:00:00Z',
    },
  })
  assert.equal(event.kind, 'paid')
  assert.equal(event.orderId, 'tran_abc')
  assert.equal(event.plan, 'business')
  assert.equal(event.billingCycle, 'yearly')
  delete process.env.NEXT_PUBLIC_CREEM_BUSINESS_YEARLY_URL
})

test('cancellation and refund events normalize', () => {
  const cancelled = creem.normalizeCreemEvent({
    eventType: 'subscription.canceled',
    object: { id: 'sub_9' },
  })
  assert.deepEqual(cancelled, { kind: 'cancelled', subscriptionId: 'sub_9' })

  const refund = creem.normalizeCreemEvent({
    eventType: 'refund.created',
    object: { order: { id: 'ord_9' } },
  })
  assert.equal(refund.kind, 'refund_or_dispute')
  assert.equal(refund.disposition, 'refunded')
})

test('unknown event types are ignored, not errors', () => {
  const event = creem.normalizeCreemEvent({ eventType: 'customer.updated', object: {} })
  assert.equal(event.kind, 'ignored')
})

console.log('rate-limit.ts (§8.3)')

test('windowStartFor aligns to fixed windows', () => {
  const rule = { scope: 't', limit: 5, windowSeconds: 60 }
  const a = rateLimit.windowStartFor(rule, new Date('2026-06-12T10:00:05Z'))
  const b = rateLimit.windowStartFor(rule, new Date('2026-06-12T10:00:59Z'))
  const c = rateLimit.windowStartFor(rule, new Date('2026-06-12T10:01:01Z'))
  assert.equal(a.getTime(), b.getTime())
  assert.notEqual(b.getTime(), c.getTime())
})

console.log('')
console.log(`${passed} passed, ${failed} failed`)
rmSync(buildDir, { recursive: true, force: true })
if (failed > 0) process.exit(1)
