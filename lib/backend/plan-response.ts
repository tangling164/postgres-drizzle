import { EntitlementResult } from '@/lib/backend/entitlement'
import { PLAN_FORM_LIMITS, planFeatures } from '@/lib/backend/plans'

export function planResponse(entitlement: EntitlementResult) {
  const effectivePlan = entitlement.effectivePlan
  return {
    plan: effectivePlan,
    billing_cycle: entitlement.billingCycle,
    reason: entitlement.reason,
    valid_until: entitlement.planExpiresAt?.toISOString() ?? null,
    plan_limit: effectivePlan === 'none' ? 0 : PLAN_FORM_LIMITS[effectivePlan],
    features: planFeatures(effectivePlan),
    free_trial: entitlement.trial
      ? {
          expires_at: entitlement.trial.expiresAt.toISOString(),
          send_limit: entitlement.trial.sendLimit,
          send_used: entitlement.trial.sendUsed,
          status: entitlement.trial.status,
        }
      : null,
  }
}
