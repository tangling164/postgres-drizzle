/**
 * License activation decision logic (Full_Backend_Spec v4.1 §5.1 state machine).
 *
 * `evaluateActivation` is a pure function so the state machine is unit-testable;
 * the API route runs it inside a transaction after locking the license and
 * account rows (SELECT ... FOR UPDATE).
 */
import { PLAN_RANK, PaidPlan, isPaidPlan } from '@/lib/backend/plans'

export interface ActivationLicense {
  id: string
  plan: string
  status: string
  activatedAccountId: string | null
  validUntil: Date | null
}

export interface ActivationAccount {
  id: string
  plan: string
  planExpiresAt: Date | null
  hasActiveLicense: boolean
}

export type ActivationDecision =
  | { kind: 'activate'; plan: PaidPlan; validUntil: Date }
  | { kind: 'already_active' }
  | {
      kind: 'error'
      httpStatus: number
      error:
        | 'license_not_found'
        | 'license_already_used'
        | 'license_revoked'
        | 'license_expired'
        | 'lower_tier_license_not_allowed'
    }

export function evaluateActivation(
  license: ActivationLicense | null,
  account: ActivationAccount,
  now: Date = new Date()
): ActivationDecision {
  if (!license) {
    return { kind: 'error', httpStatus: 404, error: 'license_not_found' }
  }

  if (license.status === 'active') {
    if (license.activatedAccountId === account.id) {
      return { kind: 'already_active' }
    }
    return { kind: 'error', httpStatus: 409, error: 'license_already_used' }
  }

  if (
    license.status === 'revoked' ||
    license.status === 'superseded' ||
    license.status === 'expired'
  ) {
    return { kind: 'error', httpStatus: 410, error: 'license_revoked' }
  }

  // status === 'pending' from here on.
  if (!isPaidPlan(license.plan)) {
    // Defensive: licenses are only ever generated for paid plans.
    return { kind: 'error', httpStatus: 410, error: 'license_revoked' }
  }

  // Review v5 P1-03: pending licenses follow the Creem paid period. A pending
  // license whose period already ended (e.g. cancelled then never activated)
  // is no longer activatable.
  if (license.validUntil === null || license.validUntil.getTime() < now.getTime()) {
    return { kind: 'error', httpStatus: 410, error: 'license_expired' }
  }

  // §5.1 plan priority: an account holding a valid higher-tier entitlement
  // must not be silently downgraded by activating a lower-tier code.
  const accountPaidValid =
    isPaidPlan(account.plan) &&
    account.hasActiveLicense &&
    account.planExpiresAt !== null &&
    account.planExpiresAt.getTime() >= now.getTime()

  if (
    accountPaidValid &&
    PLAN_RANK[license.plan] < PLAN_RANK[account.plan as PaidPlan]
  ) {
    return {
      kind: 'error',
      httpStatus: 409,
      error: 'lower_tier_license_not_allowed',
    }
  }

  return { kind: 'activate', plan: license.plan, validUntil: license.validUntil }
}
