import { EntitlementReason, resolveEntitlementFrom } from '@/lib/backend/entitlement'
import { PaidPlan } from '@/lib/backend/plans'
import { getSql } from '@/lib/db/client'

type DeniedReason = Exclude<EntitlementReason, 'paid_active' | 'free_active'>

export type ReserveSendResult =
  | { kind: 'paid'; plan: PaidPlan }
  | {
      kind: 'reserved'
      reservationId: string
      sendUsed: number
      sendLimit: number
      expiresAt: Date
    }
  | { kind: 'denied'; reason: DeniedReason }

export type ReleaseSendResult =
  | { released: false }
  | { released: true; sendUsed: number }

export async function reserveAccountSend(accountId: string): Promise<ReserveSendResult> {
  const sql = getSql({ transaction: true })
  return sql.begin(async (tx) => {
    const rows = await tx`
      SELECT
        a.plan,
        a.plan_expires_at,
        a.entitlement_status,
        l.plan AS license_plan,
        l.valid_until AS license_valid_until,
        o.billing_cycle AS license_billing_cycle,
        t.expires_at AS trial_expires_at,
        t.send_limit AS trial_send_limit,
        t.send_used AS trial_send_used,
        t.status AS trial_status
      FROM accounts a
      LEFT JOIN licenses l
        ON l.activated_account_id = a.id AND l.status = 'active'
      LEFT JOIN orders o ON o.id = l.order_id
      LEFT JOIN free_trials t ON t.account_id = a.id
      WHERE a.id = ${accountId} AND a.status = 'active'
      LIMIT 1
      FOR UPDATE OF a
    `
    if (rows.length === 0) return { kind: 'denied', reason: 'no_entitlement' }
    const row = rows[0]
    const entitlement = resolveEntitlementFrom({
      account: {
        plan: row.plan,
        planExpiresAt: row.plan_expires_at,
        entitlementStatus: row.entitlement_status,
      },
      activeLicense: row.license_plan
        ? {
            plan: row.license_plan,
            validUntil: row.license_valid_until,
            billingCycle: row.license_billing_cycle,
          }
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

    if (entitlement.effectivePlan === 'standard' || entitlement.effectivePlan === 'business') {
      return { kind: 'paid', plan: entitlement.effectivePlan }
    }
    if (entitlement.effectivePlan !== 'free' || !entitlement.trial) {
      return { kind: 'denied', reason: entitlement.reason as DeniedReason }
    }

    const trials = await tx`
      UPDATE free_trials
      SET send_used = send_used + 1,
          status = CASE
            WHEN send_used + 1 >= send_limit THEN 'exhausted'::trial_status
            ELSE status
          END,
          updated_at = now()
      WHERE account_id = ${accountId}
        AND status = 'active'
        AND expires_at >= now()
        AND send_used < send_limit
      RETURNING send_used, send_limit, expires_at
    `
    if (trials.length === 0) {
      const reason: DeniedReason =
        entitlement.trial.expiresAt.getTime() < Date.now()
          ? 'free_trial_expired'
          : 'free_trial_exhausted'
      return { kind: 'denied', reason }
    }

    const reservations = await tx`
      INSERT INTO send_reservations (account_id)
      VALUES (${accountId})
      RETURNING id
    `
    return {
      kind: 'reserved',
      reservationId: reservations[0].id as string,
      sendUsed: trials[0].send_used as number,
      sendLimit: trials[0].send_limit as number,
      expiresAt: trials[0].expires_at as Date,
    }
  })
}

export async function releaseAccountSend(
  accountId: string,
  reservationId: string
): Promise<ReleaseSendResult> {
  const sql = getSql({ transaction: true })
  return sql.begin(async (tx) => {
    const reservations = await tx`
      DELETE FROM send_reservations
      WHERE id = ${reservationId}
        AND account_id = ${accountId}
      RETURNING id
    `
    if (reservations.length === 0) return { released: false }

    const trials = await tx`
      UPDATE free_trials
      SET send_used = GREATEST(0, send_used - 1),
          status = CASE
            WHEN expires_at < now() THEN 'expired'::trial_status
            ELSE 'active'::trial_status
          END,
          updated_at = now()
      WHERE account_id = ${accountId}
      RETURNING send_used
    `
    return {
      released: true,
      sendUsed: trials.length > 0 ? (trials[0].send_used as number) : 0,
    }
  })
}
