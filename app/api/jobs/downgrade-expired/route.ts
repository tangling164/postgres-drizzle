/**
 * GET /api/jobs/downgrade-expired — daily Vercel Cron (Full_Backend_Spec
 * v4.1 §5.2 到期降级). Phase 1 has no forms to pause; the job downgrades
 * account plans, expires licenses past their paid period, and sends the
 * downgrade email. Auth: Vercel Cron's `Authorization: Bearer CRON_SECRET`.
 */
import { NextRequest, NextResponse } from 'next/server'
import { runExpiredDowngrades } from '@/lib/backend/downgrade'
import { sendDowngradeExecutedEmail } from '@/lib/backend/emails'

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

  const downgraded = await runExpiredDowngrades()

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
