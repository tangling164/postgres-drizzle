/**
 * Creem webhook: signature verification + payload normalization
 * (Full_Backend_Spec v4.1 §4.2 / §4.5). Pure module — unit-testable.
 *
 * ⚠️ Phase 0 gate (§10.0): exact event names and payload field paths MUST be
 * confirmed against the Creem sandbox before launch. All payload assumptions
 * are isolated in `normalizeCreemEvent` below so sandbox findings require
 * changes in exactly one place.
 */
import { createHmac } from 'node:crypto'
import { timingSafeEqualHex } from '@/lib/backend/license'
import { BillingCycle, PaidPlan } from '@/lib/backend/plans'

export function computeCreemSignature(rawBody: string, secret: string): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex')
}

export function verifyCreemSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader) return false
  const expected = computeCreemSignature(rawBody, secret)
  return timingSafeEqualHex(expected, signatureHeader.trim())
}

export type CreemEvent =
  | {
      kind: 'paid'
      orderId: string
      subscriptionId: string | null
      buyerEmail: string
      plan: PaidPlan
      billingCycle: BillingCycle
      amountCents: number
      currency: string
      periodEnd: Date | null
    }
  | { kind: 'cancelled'; subscriptionId: string }
  | { kind: 'payment_failed'; subscriptionId: string | null; buyerEmail: string | null }
  | { kind: 'refund_or_dispute'; orderId: string; disposition: 'refunded' | 'disputed' }
  | { kind: 'ignored'; type: string }

/* eslint-disable @typescript-eslint/no-explicit-any */
function pick(source: any, paths: string[][]): unknown {
  for (const path of paths) {
    let current: any = source
    for (const segment of path) {
      current = current?.[segment]
      if (current === undefined || current === null) break
    }
    if (current !== undefined && current !== null) return current
  }
  return null
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function parsePlan(value: unknown): PaidPlan | null {
  const text = String(value ?? '').toLowerCase()
  if (text.includes('business')) return 'business'
  if (text.includes('standard')) return 'standard'
  return null
}

function parseBillingCycle(value: unknown): BillingCycle | null {
  const text = String(value ?? '').toLowerCase()
  if (text.includes('year') || text === 'annual' || text === 'annually') return 'yearly'
  if (text.includes('month')) return 'monthly'
  return null
}

function parseDate(value: unknown): Date | null {
  if (!value) return null
  const date = new Date(value as string | number)
  return Number.isNaN(date.getTime()) ? null : date
}

export class CreemPayloadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CreemPayloadError'
  }
}

/**
 * Maps a raw Creem webhook body to the internal event model. Throws
 * CreemPayloadError when a known event is missing required fields (the route
 * answers 500 so Creem retries while we investigate).
 */
export function normalizeCreemEvent(body: unknown): CreemEvent {
  const root = body as Record<string, unknown>
  const type = String(root?.eventType ?? root?.type ?? '').toLowerCase()
  const data = (root?.object ?? root?.data ?? {}) as Record<string, unknown>

  const orderId = pick(data, [['order', 'id'], ['order_id'], ['id']])
  const subscriptionId = pick(data, [
    ['subscription', 'id'],
    ['subscription_id'],
    ['id'],
  ])

  if (
    type === 'checkout.completed' ||
    type === 'order.paid' ||
    type === 'subscription.paid' ||
    type === 'subscription.active' ||
    type === 'subscription.renewed'
  ) {
    const buyerEmail = pick(data, [
      ['customer', 'email'],
      ['order', 'customer', 'email'],
      ['email'],
    ])
    const plan =
      parsePlan(pick(data, [['metadata', 'plan'], ['order', 'metadata', 'plan']])) ??
      parsePlan(pick(data, [['product', 'name'], ['order', 'product', 'name']]))
    const billingCycle =
      parseBillingCycle(
        pick(data, [['metadata', 'billing_cycle'], ['order', 'metadata', 'billing_cycle']])
      ) ??
      parseBillingCycle(
        pick(data, [['product', 'billing_period'], ['subscription', 'billing_period']])
      )
    const periodEnd = parseDate(
      pick(data, [
        ['subscription', 'current_period_end_date'],
        ['subscription', 'current_period_end'],
        ['current_period_end_date'],
        ['current_period_end'],
      ])
    )

    if (!orderId || !buyerEmail || !plan || !billingCycle) {
      throw new CreemPayloadError(
        `paid event missing required fields (type=${type}, order=${orderId}, email=${Boolean(
          buyerEmail
        )}, plan=${plan}, cycle=${billingCycle})`
      )
    }

    return {
      kind: 'paid',
      orderId: String(orderId),
      subscriptionId: subscriptionId ? String(subscriptionId) : null,
      buyerEmail: String(buyerEmail),
      plan,
      billingCycle,
      amountCents: Number(pick(data, [['order', 'amount'], ['amount']]) ?? 0),
      currency: String(pick(data, [['order', 'currency'], ['currency']]) ?? 'USD'),
      periodEnd,
    }
  }

  if (
    type === 'subscription.canceled' ||
    type === 'subscription.cancelled' ||
    type === 'subscription.expired'
  ) {
    if (!subscriptionId) {
      throw new CreemPayloadError(`cancel event missing subscription id (type=${type})`)
    }
    return { kind: 'cancelled', subscriptionId: String(subscriptionId) }
  }

  if (type === 'payment.failed' || type === 'subscription.past_due') {
    return {
      kind: 'payment_failed',
      subscriptionId: subscriptionId ? String(subscriptionId) : null,
      buyerEmail: (pick(data, [['customer', 'email'], ['email']]) as string) ?? null,
    }
  }

  if (type === 'refund.created' || type === 'dispute.created') {
    const refundOrderId = pick(data, [
      ['order', 'id'],
      ['order_id'],
      ['checkout', 'order', 'id'],
    ])
    if (!refundOrderId) {
      throw new CreemPayloadError(`refund event missing order id (type=${type})`)
    }
    return {
      kind: 'refund_or_dispute',
      orderId: String(refundOrderId),
      disposition: type === 'dispute.created' ? 'disputed' : 'refunded',
    }
  }

  return { kind: 'ignored', type }
}
