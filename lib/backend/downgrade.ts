import { getSql } from '@/lib/db/client'

export interface DowngradedAccount {
  email: string | null
  previousPlan: string
}

export async function runExpiredDowngrades(): Promise<DowngradedAccount[]> {
  const sql = getSql({ transaction: true })

  await sql`
    UPDATE free_trials SET status = 'expired', updated_at = now()
    WHERE status = 'active' AND expires_at < now()
  `

  return sql.begin(async (tx) => {
    // The active license row is authoritative. Repair a stale account expiry
    // before deciding whether a paid account should be downgraded.
    await tx`
      UPDATE accounts a
      SET plan_expires_at = l.valid_until,
          updated_at = now()
      FROM licenses l
      WHERE l.activated_account_id = a.id
        AND l.status = 'active'
        AND l.plan = a.plan
        AND l.valid_until IS NOT NULL
        AND a.plan_expires_at IS DISTINCT FROM l.valid_until
    `

    const accounts = await tx`
      SELECT a.id, a.plan, a.email
      FROM accounts a
      WHERE a.plan IN ('standard', 'business')
        AND a.plan_expires_at IS NOT NULL
        AND a.plan_expires_at < now()
        AND a.status = 'active'
      FOR UPDATE OF a
    `
    if (accounts.length === 0) return []

    const results: DowngradedAccount[] = []
    for (const account of accounts) {
      const expiredLicenses = await tx`
        UPDATE licenses SET status = 'expired'
        WHERE activated_account_id = ${account.id}
          AND status = 'active'
          AND valid_until < now()
        RETURNING order_id
      `

      const trialRows = await tx`
        SELECT status, expires_at, send_limit, send_used
        FROM free_trials WHERE account_id = ${account.id} LIMIT 1
      `
      const trial = trialRows[0]
      const trialUsable =
        trial !== undefined &&
        trial.status === 'active' &&
        trial.send_used < trial.send_limit &&
        new Date(trial.expires_at).getTime() >= Date.now()

      await tx`
        UPDATE accounts
        SET plan = 'free', plan_expires_at = NULL,
            entitlement_status = ${trialUsable ? 'active' : 'expired'},
            updated_at = now()
        WHERE id = ${account.id}
      `

      let email: string | null = account.email
      if (expiredLicenses.length > 0) {
        const orders = await tx`
          SELECT buyer_email FROM orders
          WHERE id = ${expiredLicenses[0].order_id} LIMIT 1
        `
        email = (orders[0]?.buyer_email as string) ?? email
      }
      results.push({ email, previousPlan: account.plan })
    }
    return results
  })
}
