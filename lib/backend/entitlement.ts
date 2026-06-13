/**
 * Entitlement resolution — the single source of truth for what a user may do
 * (Full_Backend_Spec v4.1 §6.3 权威状态对照矩阵 + Review v5 P1-01).
 *
 * Paid entitlement requires BOTH the account plan fields AND a currently
 * `active`, unexpired license row. `accounts.plan` alone is a display cache
 * and must never grant paid features by itself.
 */
import { getSql } from '@/lib/db/client'
import { EffectivePlan, isPaidPlan } from '@/lib/backend/plans'

export type EntitlementReason =
  | 'paid_active'
  | 'free_active'
  | 'free_trial_expired'
  | 'free_trial_exhausted'
  | 'no_entitlement'

export interface EntitlementResult {
  effectivePlan: EffectivePlan
  reason: EntitlementReason
  planExpiresAt: Date | null
  trial: {
    expiresAt: Date
    sendLimit: number
    sendUsed: number
    status: string
  } | null
}

export interface EntitlementInput {
  account: {
    plan: string
    planExpiresAt: Date | null
    entitlementStatus: string
  }
  /** The account's license row with status='active', if any. */
  activeLicense: { plan: string; validUntil: Date | null } | null
  trial: {
    expiresAt: Date
    sendLimit: number
    sendUsed: number
    status: string
  } | null
}

/** Pure decision function; covered by tests/backend. */
export function resolveEntitlementFrom(
  input: EntitlementInput,
  now: Date = new Date()
): EntitlementResult {
  const { account, activeLicense, trial } = input

  const paidValid =
    isPaidPlan(account.plan) &&
    account.entitlementStatus !== 'revoked' &&
    account.planExpiresAt !== null &&
    account.planExpiresAt.getTime() >= now.getTime() &&
    activeLicense !== null &&
    activeLicense.plan === account.plan &&
    activeLicense.validUntil !== null &&
    activeLicense.validUntil.getTime() >= now.getTime()

  if (paidValid && isPaidPlan(account.plan)) {
    return {
      effectivePlan: account.plan,
      reason: 'paid_active',
      planExpiresAt: account.planExpiresAt,
      trial,
    }
  }

  if (!trial) {
    return {
      effectivePlan: 'none',
      reason: 'no_entitlement',
      planExpiresAt: null,
      trial: null,
    }
  }

  const trialExhausted =
    trial.status === 'exhausted' || trial.sendUsed >= trial.sendLimit
  if (trialExhausted) {
    return {
      effectivePlan: 'none',
      reason: 'free_trial_exhausted',
      planExpiresAt: null,
      trial,
    }
  }

  const trialExpired =
    trial.status === 'expired' || trial.expiresAt.getTime() < now.getTime()
  if (trialExpired) {
    return {
      effectivePlan: 'none',
      reason: 'free_trial_expired',
      planExpiresAt: null,
      trial,
    }
  }

  return {
    effectivePlan: 'free',
    reason: 'free_active',
    planExpiresAt: null,
    trial,
  }
}

/** Loads account + active license + trial and resolves entitlement. */
export async function resolveEntitlement(
  accountId: string
): Promise<EntitlementResult | null> {
  const sql = getSql()
  const rows = await sql`
    SELECT
      a.plan,
      a.plan_expires_at,
      a.entitlement_status,
      l.plan        AS license_plan,
      l.valid_until AS license_valid_until,
      t.expires_at  AS trial_expires_at,
      t.send_limit  AS trial_send_limit,
      t.send_used   AS trial_send_used,
      t.status      AS trial_status
    FROM accounts a
    LEFT JOIN licenses l
      ON l.activated_account_id = a.id AND l.status = 'active'
    LEFT JOIN free_trials t ON t.account_id = a.id
    WHERE a.id = ${accountId} AND a.status = 'active'
    LIMIT 1
  `
  if (rows.length === 0) return null
  const row = rows[0]

  return resolveEntitlementFrom({
    account: {
      plan: row.plan,
      planExpiresAt: row.plan_expires_at,
      entitlementStatus: row.entitlement_status,
    },
    activeLicense: row.license_plan
      ? { plan: row.license_plan, validUntil: row.license_valid_until }
      : null,
    trial: row.trial_expires_at
      ? {
          expiresAt: row.trial_expires_at,
          sendLimit: row.trial_send_limit,
          sendUsed: row.trial_send_used,
          status: row.trial_status,
        }
      : null,
  })
}
