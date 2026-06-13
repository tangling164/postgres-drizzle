/**
 * POST /api/webhooks/creem (Full_Backend_Spec v4.1 §4.2 / §7.1).
 *
 * Response contract: 401 invalid signature, 200 processed/duplicate/ignored,
 * 500 on processing errors so Creem retries with backoff.
 */
import { NextRequest, NextResponse } from 'next/server'
import {
  CreemPayloadError,
  normalizeCreemEvent,
  verifyCreemSignature,
} from '@/lib/backend/creem'
import { handleCreemEvent } from '@/lib/backend/creem-handlers'

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

  try {
    const event = normalizeCreemEvent(body)
    const result = await handleCreemEvent(event)
    console.log(`[creem-webhook] ${event.kind}: ${result.note}`)
    return NextResponse.json({ received: true })
  } catch (error) {
    if (error instanceof CreemPayloadError) {
      // Known event with missing fields: needs investigation; let Creem retry.
      console.error(`[creem-webhook] payload error: ${error.message}`)
      return NextResponse.json({ error: 'payload_error' }, { status: 500 })
    }
    console.error('[creem-webhook] processing failed:', error)
    return NextResponse.json({ error: 'processing_failed' }, { status: 500 })
  }
}
