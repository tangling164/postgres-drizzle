import { getSql } from '@/lib/db/client'

const STALE_PROCESSING_MINUTES = 10

export type WebhookClaim =
  | { claimed: true; attemptCount: number }
  | { claimed: false; status: 'processing' | 'processed' }

export async function claimWebhookEvent(input: {
  provider: string
  eventId: string
  eventType: string
  payloadSha256: string
}): Promise<WebhookClaim> {
  const sql = getSql({ transaction: true })
  return sql.begin(async (tx) => {
    const inserted = await tx`
      INSERT INTO webhook_events (
        provider, event_id, event_type, payload_sha256, status
      ) VALUES (
        ${input.provider}, ${input.eventId}, ${input.eventType},
        ${input.payloadSha256}, 'processing'
      )
      ON CONFLICT (provider, event_id) DO NOTHING
      RETURNING attempt_count
    `
    if (inserted.length > 0) {
      return { claimed: true, attemptCount: inserted[0].attempt_count as number }
    }

    const existing = await tx`
      SELECT payload_sha256, status, updated_at
      FROM webhook_events
      WHERE provider = ${input.provider} AND event_id = ${input.eventId}
      FOR UPDATE
    `
    if (existing.length === 0) throw new Error('Webhook event claim was lost')

    const event = existing[0]
    if (event.payload_sha256 !== input.payloadSha256) {
      throw new Error('Webhook event id was reused with a different payload')
    }
    if (event.status === 'processed') {
      return { claimed: false, status: 'processed' }
    }
    const staleBefore = Date.now() - STALE_PROCESSING_MINUTES * 60 * 1000
    if (
      event.status === 'processing' &&
      new Date(event.updated_at).getTime() >= staleBefore
    ) {
      return { claimed: false, status: 'processing' }
    }

    const reclaimed = await tx`
      UPDATE webhook_events
      SET status = 'processing',
          event_type = ${input.eventType},
          attempt_count = attempt_count + 1,
          updated_at = now()
      WHERE provider = ${input.provider} AND event_id = ${input.eventId}
      RETURNING attempt_count
    `
    return { claimed: true, attemptCount: reclaimed[0].attempt_count as number }
  })
}

export async function completeWebhookEvent(
  provider: string,
  eventId: string,
  attemptCount: number
): Promise<void> {
  const sql = getSql()
  await sql`
    UPDATE webhook_events
    SET status = 'processed', processed_at = now(), updated_at = now()
    WHERE provider = ${provider} AND event_id = ${eventId}
      AND status = 'processing'
      AND attempt_count = ${attemptCount}
  `
}

export async function failWebhookEvent(
  provider: string,
  eventId: string,
  attemptCount: number
): Promise<void> {
  const sql = getSql()
  await sql`
    UPDATE webhook_events
    SET status = 'failed', updated_at = now()
    WHERE provider = ${provider} AND event_id = ${eventId}
      AND status = 'processing'
      AND attempt_count = ${attemptCount}
  `
}
