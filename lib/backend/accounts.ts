/**
 * Account bootstrap (Full_Backend_Spec v4.1 §2.3 / §3.14).
 *
 * Accounts are created lazily on the first authenticated API call from the
 * add-on (no web login exists). Account + free trial are created in one
 * transaction; a deleted-account tombstone hit means the trial starts in the
 * `exhausted` state so deletion cannot be used to farm new free trials.
 */
import { createHmac } from 'node:crypto'
import { getSql } from '@/lib/db/client'
import { FREE_TRIAL_DAYS, FREE_TRIAL_SEND_LIMIT } from '@/lib/backend/plans'

export interface AccountRow {
  id: string
  google_subject: string
  email: string | null
  plan: string
  plan_expires_at: Date | null
  entitlement_status: string
  status: string
}

/**
 * Tombstones store HMAC(google_subject) instead of the raw subject (§3.14).
 * LICENSE_PEPPER doubles as the HMAC key to keep the Phase 1 secret set small.
 */
export function hashGoogleSubject(googleSubject: string): string {
  const pepper = process.env.LICENSE_PEPPER
  if (!pepper) throw new Error('LICENSE_PEPPER is not configured')
  return createHmac('sha256', pepper).update(googleSubject).digest('hex')
}

export async function ensureAccount(
  googleSubject: string,
  email: string | null
): Promise<AccountRow> {
  const sql = getSql({ transaction: true })

  const existing = await sql`
    SELECT id, google_subject, email, plan, plan_expires_at, entitlement_status, status
    FROM accounts
    WHERE google_subject = ${googleSubject}
    LIMIT 1
  `
  if (existing.length > 0) {
    const account = existing[0] as unknown as AccountRow
    if (email && account.email !== email) {
      await sql`
        UPDATE accounts SET email = ${email}, updated_at = now()
        WHERE id = ${account.id}
      `
      account.email = email
    }
    return account
  }

  const subjectHash = hashGoogleSubject(googleSubject)

  const created = await sql.begin(async (tx) => {
    const inserted = await tx`
      INSERT INTO accounts (google_subject, email)
      VALUES (${googleSubject}, ${email})
      ON CONFLICT (google_subject) DO NOTHING
      RETURNING id, google_subject, email, plan, plan_expires_at, entitlement_status, status
    `

    if (inserted.length === 0) {
      // Concurrent bootstrap won the race; reuse its row.
      const winner = await tx`
        SELECT id, google_subject, email, plan, plan_expires_at, entitlement_status, status
        FROM accounts WHERE google_subject = ${googleSubject} LIMIT 1
      `
      return winner[0] as unknown as AccountRow
    }

    const account = inserted[0] as unknown as AccountRow

    const tombstones = await tx`
      SELECT 1 FROM deleted_accounts
      WHERE google_subject_hash = ${subjectHash}
      LIMIT 1
    `
    const trialAlreadyConsumed = tombstones.length > 0

    if (trialAlreadyConsumed) {
      await tx`
        INSERT INTO free_trials (account_id, expires_at, send_limit, send_used, status)
        VALUES (${account.id}, now(), ${FREE_TRIAL_SEND_LIMIT}, ${FREE_TRIAL_SEND_LIMIT}, 'exhausted')
      `
    } else {
      await tx`
        INSERT INTO free_trials (account_id, expires_at, send_limit, send_used, status)
        VALUES (
          ${account.id},
          now() + make_interval(days => ${FREE_TRIAL_DAYS}),
          ${FREE_TRIAL_SEND_LIMIT},
          0,
          'active'
        )
      `
    }

    return account
  })

  return created
}
