/**
 * GET /api/jobs/downgrade-expired — daily Vercel Cron (Full_Backend_Spec
 * v4.1 §5.2 到期降级). Phase 1 has no forms to pause; the job downgrades
 * account plans, expires licenses past their paid period, and sends the
 * downgrade email. Auth: Vercel Cron's `Authorization: Bearer CRON_SECRET`.
 */
import { NextRequest, NextResponse } from 'next/server'
import { sendDowngradeExecutedEmail } from '@/lib/backend/emails'
import { getSql } from '@/lib/db/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[downgrade-job] CRON_SECRET is not configured')
    return NextResponse.json({ error: 'not_configured' }, { status: 500 })
  }
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const sql = getSql({ transaction: true })

  // Hygiene: persist trial expiry (resolveEntitlement also derives this at
  // read time, so this is bookkeeping, not a correctness dependency).
  await sql`
    UPDATE free_trials SET status = 'expired', updated_at = now()
    WHERE status = 'active' AND expires_at < now()
  `

  const downgraded = await sql.begin(async (tx) => {
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

    const results: { email: string | null; previousPlan: string }[] = []
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

  // Emails go out after the transaction commits; a single failed email must
  // not roll back the downgrades or block the rest of the batch.
  let emailed = 0
  for (const item of downgraded) {
    if (!item.email) continue
    try {
      await sendDowngradeExecutedEmail({
        to: item.email,
        previousPlan: item.previousPlan,
      })
      emailed += 1
    } catch (error) {
      console.error('[downgrade-job] downgrade email failed:', error)
    }
  }

  return NextResponse.json({ downgraded: downgraded.length, emailed })
}
