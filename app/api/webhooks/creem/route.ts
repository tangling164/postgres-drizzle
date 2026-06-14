/**
 * POST /api/webhooks/creem (Full_Backend_Spec v4.1 §4.2 / §7.1).
 *
 * Response contract: 401 invalid signature, 200 processed/duplicate/ignored,
 * 500 on processing errors so Creem retries with backoff.
 */
import { NextRequest, NextResponse } from 'next/server'
import {
  CreemPayloadError,
  creemEventIdentity,
  normalizeCreemEvent,
  verifyCreemSignature,
} from '@/lib/backend/creem'
import { handleCreemEvent } from '@/lib/backend/creem-handlers'
import {
  claimWebhookEvent,
  completeWebhookEvent,
  failWebhookEvent,
} from '@/lib/backend/webhook-events'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const secret = process.env.CREEM_WEBHOOK_SECRET
  if (!secret) {
    console.error('[creem-webhook] CREEM_WEBHOOK_SECRET is not configured')
    return NextResponse.json({ error: 'not_configured' }, { status: 500 })
  }

  const rawBody = await request.text()
  const signature = request.headers.get('creem-signature')

  if (!verifyCreemSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const identity = creemEventIdentity(body, rawBody)
  let claimAttempt: number | null = null
  try {
    const claim = await claimWebhookEvent({
      provider: 'creem',
      eventId: identity.eventId,
      eventType: identity.eventType,
      payloadSha256: identity.payloadSha256,
    })
    if (!claim.claimed) {
      if (claim.status === 'processing') {
        return NextResponse.json(
          { received: false, retry: true, error: 'event_processing' },
          { status: 503, headers: { 'Retry-After': '30' } }
        )
      }
      return NextResponse.json({ received: true, duplicate: true })
    }
    claimAttempt = claim.attemptCount
    const event = normalizeCreemEvent(body)
    const result = await handleCreemEvent(event)
    await completeWebhookEvent('creem', identity.eventId, claimAttempt)
    const detail =
      event.kind === 'ignored'
        ? event.type
        : event.kind === 'paid'
          ? `${event.sourceType} order=${event.orderId} plan=${event.plan}`
          : event.kind
    console.log(`[creem-webhook] ${event.kind} (${detail}): ${result.note}`)
    return NextResponse.json({ received: true })
  } catch (error) {
    if (claimAttempt !== null) {
      await failWebhookEvent('creem', identity.eventId, claimAttempt).catch((markError) => {
        console.error('[creem-webhook] failed to mark event failed:', markError)
      })
    }
    if (error instanceof CreemPayloadError) {
      console.error(`[creem-webhook] payload error: ${error.message}`)
      return NextResponse.json({ error: 'payload_error', message: error.message }, { status: 500 })
    }
    const message = error instanceof Error ? error.message : String(error)
    const pgCode =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code: unknown }).code)
        : undefined
    console.error(
      '[creem-webhook] processing failed:',
      message,
      pgCode ? `(pg:${pgCode})` : ''
    )
    return NextResponse.json(
      {
        error: 'processing_failed',
        message,
        hint:
          pgCode === '42P01'
            ? 'Database tables missing — run pnpm migrate against production Neon'
            : undefined,
      },
      { status: 500 }
    )
  }
}
