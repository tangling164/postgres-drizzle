/** Plan constants (Full_Backend_Spec v4.1 §2.1, confirmed 2026-06-12). */

export type PaidPlan = 'standard' | 'business'
export type PlanTier = 'free' | PaidPlan
export type EffectivePlan = PlanTier | 'none'

export const PLAN_FORM_LIMITS: Record<PlanTier, number> = {
  free: 1,
  standard: 20,
  business: 100,
}

export const PLAN_RANK: Record<PlanTier, number> = {
  free: 1,
  standard: 2,
  business: 3,
}

export const FREE_TRIAL_DAYS = 7
export const FREE_TRIAL_SEND_LIMIT = 30

export const BILLING_CYCLE_DAYS = { monthly: 30, yearly: 365 } as const
export type BillingCycle = keyof typeof BILLING_CYCLE_DAYS

export function isPaidPlan(plan: string): plan is PaidPlan {
  return plan === 'standard' || plan === 'business'
}

export function planFeatures(plan: EffectivePlan): string[] {
  if (plan === 'standard' || plan === 'business') {
    return ['markdown_template', 'custom_payload', 'conditions']
  }
  return []
}
