/**
 * POST /v2/license/activate (Full_Backend_Spec v4.1 §5.1 / §7.2).
 *
 * Auth: Google OIDC identity token from the add-on. The whole state machine
 * runs inside one transaction with the license and account rows locked.
 * Phase 1 note: auto-resume of downgrade-paused forms is a V2 concern — there
 * are no forms tables yet, so `auto_resumed_forms` is always [].
 * Rate limits (§8.3): 5/min per IP + 15-minute lockout after 5 failures.
 */
import { NextRequest, NextResponse } from 'next/server'
import { evaluateActivation } from '@/lib/backend/activation'
import { ensureAccount } from '@/lib/backend/accounts'
import {
  hashLicenseCode,
  isValidLicenseCodeFormat,
  normalizeLicenseCode,
} from '@/lib/backend/license'
import { OidcError, verifyIdentityToken } from '@/lib/backend/google-oidc'
import { planFeatures } from '@/lib/backend/plans'
import {
  RATE_LIMIT_RULES,
  clientIpFrom,
  hitRateLimit,
  isRateLimited,
} from '@/lib/backend/rate-limit'
import { getSql } from '@/lib/db/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const ip = clientIpFrom(request.headers)

  const [{ allowed }, lockedOut] = await Promise.all([
    hitRateLimit(RATE_LIMIT_RULES.activate, ip),
    isRateLimited(RATE_LIMIT_RULES.activateFailures, ip),
  ])
  if (!allowed || lockedOut) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  let identity
  try {
    identity = await verifyIdentityToken(request.headers.get('authorization'))
  } catch (error) {
    if (error instanceof OidcError) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    throw error
  }

  const body = (await request.json().catch(() => ({}))) as { code?: string }
  const rawCode = body.code ?? ''

  const recordFailure = () =>
    hitRateLimit(RATE_LIMIT_RULES.activateFailures, ip, { recordOnly: true })

  if (!isValidLicenseCodeFormat(rawCode)) {
    await recordFailure()
    // Same response as an unknown code — no format oracle (§8.1).
    return NextResponse.json({ error: 'license_not_found' }, { status: 404 })
  }

  const pepper = process.env.LICENSE_PEPPER
  if (!pepper) {
    console.error('[activate] LICENSE_PEPPER is not configured')
    return NextResponse.json({ error: 'not_configured' }, { status: 500 })
  }
  const codeHash = hashLicenseCode(normalizeLicenseCode(rawCode), pepper)

  const account = await ensureAccount(identity.sub, identity.email)
  const sql = getSql({ transaction: true })

  const outcome = await sql.begin(async (tx) => {
    const licenses = await tx`
      SELECT l.id, l.plan, l.status, l.activated_account_id, l.valid_until,
        o.billing_cycle
      FROM licenses l
      JOIN orders o ON o.id = l.order_id
      WHERE l.code_hash = ${codeHash}
      LIMIT 1
      FOR UPDATE OF l
    `
    const licenseRow = licenses[0]

    const accounts = await tx`
      SELECT a.id, a.plan, a.plan_expires_at,
        EXISTS (
          SELECT 1 FROM licenses al
          WHERE al.activated_account_id = a.id AND al.status = 'active'
        ) AS has_active_license
      FROM accounts a
      WHERE a.id = ${account.id}
      FOR UPDATE OF a
    `
    const accountRow = accounts[0]

    const decision = evaluateActivation(
      licenseRow
        ? {
            id: licenseRow.id,
            plan: licenseRow.plan,
            status: licenseRow.status,
            activatedAccountId: licenseRow.activated_account_id,
            validUntil: licenseRow.valid_until,
          }
        : null,
      {
        id: accountRow.id,
        plan: accountRow.plan,
        planExpiresAt: accountRow.plan_expires_at,
        hasActiveLicense: accountRow.has_active_license,
      }
    )

    if (decision.kind === 'error') {
      // §5.1: a pending license whose paid period already ended flips to
      // `expired` on the activation attempt.
      if (decision.error === 'license_expired' && licenseRow) {
        await tx`UPDATE licenses SET status = 'expired' WHERE id = ${licenseRow.id}`
      }
      return decision
    }

    if (decision.kind === 'already_active') {
      return {
        kind: 'done' as const,
        status: 'already_active',
        plan: licenseRow.plan as string,
        billingCycle: licenseRow.billing_cycle as string,
        validUntil: licenseRow.valid_until as Date,
      }
    }

    // Upgrade path (§5.1): the previous active license is superseded, never
    // deleted, so its own renewal events keep their bookkeeping (P1-02).
    await tx`
      UPDATE licenses SET status = 'superseded'
      WHERE activated_account_id = ${account.id} AND status = 'active'
    `

    await tx`
      UPDATE licenses
      SET status = 'active', activated_account_id = ${account.id}, activated_at = now()
      WHERE id = ${licenseRow.id}
    `

    await tx`
      UPDATE accounts
      SET plan = ${decision.plan},
          plan_expires_at = ${decision.validUntil},
          entitlement_status = 'active',
          updated_at = now()
      WHERE id = ${account.id}
    `

    return {
      kind: 'done' as const,
      status: 'activated',
      plan: decision.plan as string,
      billingCycle: licenseRow.billing_cycle as string,
      validUntil: decision.validUntil,
    }
  })

  if (outcome.kind === 'error') {
    await recordFailure()
    return NextResponse.json(
      { error: outcome.error },
      { status: outcome.httpStatus }
    )
  }

  return NextResponse.json({
    status: outcome.status,
    plan: outcome.plan,
    billing_cycle: outcome.billingCycle,
    valid_until: outcome.validUntil.toISOString(),
    features: planFeatures(outcome.plan as 'standard' | 'business'),
    auto_resumed_forms: [],
  })
}
