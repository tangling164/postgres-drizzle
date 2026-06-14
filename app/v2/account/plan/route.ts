/**
 * GET /v2/account/plan (Full_Backend_Spec v4.1 §7.2).
 *
 * Returns the resolved entitlement for the calling Google account. This is
 * the read endpoint the add-on uses to render plan state; the effective plan
 * comes from resolveEntitlement (§6.3), never from accounts.plan alone.
 * Bootstrap: first call creates the account + free trial (§2.3).
 */
import { NextRequest, NextResponse } from 'next/server'
import { ensureAccount } from '@/lib/backend/accounts'
import { resolveEntitlement } from '@/lib/backend/entitlement'
import { OidcError, verifyIdentityToken } from '@/lib/backend/google-oidc'
import { PLAN_FORM_LIMITS, planFeatures } from '@/lib/backend/plans'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  let identity
  try {
    identity = await verifyIdentityToken(request.headers.get('authorization'))
  } catch (error) {
    if (error instanceof OidcError) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    throw error
  }

  const account = await ensureAccount(identity.sub, identity.email)
  const entitlement = await resolveEntitlement(account.id)
  if (!entitlement) {
    return NextResponse.json({ error: 'account_not_found' }, { status: 404 })
  }

  const effectivePlan = entitlement.effectivePlan
  const planLimit =
    effectivePlan === 'none' ? 0 : PLAN_FORM_LIMITS[effectivePlan]

  return NextResponse.json({
    plan: effectivePlan,
    billing_cycle: entitlement.billingCycle,
    reason: entitlement.reason,
    valid_until: entitlement.planExpiresAt?.toISOString() ?? null,
    plan_limit: planLimit,
    // V2 field: forms are managed by Cloud Monitoring, not in Phase 1.
    enabled_forms: 0,
    features: planFeatures(effectivePlan),
    free_trial: entitlement.trial
      ? {
          expires_at: entitlement.trial.expiresAt.toISOString(),
          send_limit: entitlement.trial.sendLimit,
          send_used: entitlement.trial.sendUsed,
          status: entitlement.trial.status,
        }
      : null,
  })
}
