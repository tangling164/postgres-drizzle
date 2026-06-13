/**
 * Creem webhook: signature verification + payload normalization
 * (Full_Backend_Spec v4.1 §4.2 / §4.5).
 *
 * Payload shapes: https://docs.creem.io/code/webhooks
 */
import { createHmac } from 'node:crypto'
import {
  catalogDebugHint,
  findCatalogEntry,
} from '@/lib/backend/creem-catalog'
import { timingSafeEqualHex } from '@/lib/backend/license'
import { BillingCycle, PaidPlan } from '@/lib/backend/plans'

export {
  buildCreemProductCatalog,
  extractCreemProductIdFromUrl,
} from '@/lib/backend/creem-catalog'

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
      sourceType: string
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

function asProductId(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value.trim() || null
  if (typeof value === 'object' && value !== null && 'id' in value) {
    const id = (value as { id: unknown }).id
    return id ? String(id) : null
  }
  return String(value)
}

function parsePlanFromName(value: unknown): PaidPlan | null {
  const text = String(value ?? '').toLowerCase()
  if (text.includes('business')) return 'business'
  if (text.includes('standard')) return 'standard'
  return null
}

function parseBillingCycleFromText(value: unknown): BillingCycle | null {
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

function resolveProduct(
  productIdRaw: unknown,
  productName: unknown,
  billingPeriod: unknown
): { plan: PaidPlan; billingCycle: BillingCycle } | null {
  const productId = asProductId(productIdRaw)
  if (productId) {
    const fromCatalog = findCatalogEntry(productId)
    if (fromCatalog) {
      return { plan: fromCatalog.plan, billingCycle: fromCatalog.billingCycle }
    }
  }

  const plan = parsePlanFromName(productName)
  const billingCycle = parseBillingCycleFromText(billingPeriod)
  if (plan && billingCycle) return { plan, billingCycle }

  return null
}

function resolveProductFromMetadata(
  data: Record<string, unknown>
): { plan: PaidPlan; billingCycle: BillingCycle } | null {
  const metaPlan = pick(data, [['metadata', 'plan'], ['order', 'metadata', 'plan']])
  const metaCycle = pick(data, [
    ['metadata', 'billing_cycle'],
    ['order', 'metadata', 'billing_cycle'],
  ])
  const plan = parsePlanFromName(metaPlan)
  const billingCycle = parseBillingCycleFromText(metaCycle)
  if (plan && billingCycle) return { plan, billingCycle }
  return null
}

export class CreemPayloadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CreemPayloadError'
  }
}

function productResolutionError(
  sourceType: string,
  details: Record<string, unknown>
): never {
  const parts = Object.entries(details)
    .map(([key, value]) => `${key}=${value}`)
    .join(', ')
  throw new CreemPayloadError(
    `${sourceType} cannot resolve plan (${parts}). ${catalogDebugHint()}`
  )
}

function normalizeCheckoutCompleted(
  data: Record<string, unknown>,
  sourceType: string
): CreemEvent {
  const orderId = pick(data, [['order', 'id'], ['order_id']])
  const subscriptionRaw = pick(data, [['subscription']])
  const subscriptionId =
    typeof subscriptionRaw === 'string'
      ? subscriptionRaw
      : asProductId(pick(data, [['subscription', 'id']]))

  const buyerEmail = pick(data, [
    ['customer', 'email'],
    ['order', 'customer', 'email'],
    ['email'],
  ])

  const productId = pick(data, [
    ['product', 'id'],
    ['product'],
    ['order', 'product'],
  ])
  const productName = pick(data, [['product', 'name'], ['order', 'product', 'name']])
  const billingPeriod = pick(data, [
    ['product', 'billing_period'],
    ['subscription', 'billing_period'],
  ])

  const resolved =
    resolveProduct(productId, productName, billingPeriod) ??
    resolveProductFromMetadata(data)

  const periodEnd = parseDate(
    pick(data, [
      ['subscription', 'current_period_end_date'],
      ['subscription', 'current_period_end'],
      ['current_period_end_date'],
    ])
  )

  if (!orderId || !buyerEmail || !resolved) {
    productResolutionError(sourceType, {
      order: orderId ?? 'missing',
      email: buyerEmail ? 'ok' : 'missing',
      productId: asProductId(productId) ?? 'missing',
      productName: productName ?? 'missing',
      billingPeriod: billingPeriod ?? 'missing',
    })
  }

  return {
    kind: 'paid',
    orderId: String(orderId),
    subscriptionId,
    buyerEmail: String(buyerEmail),
    plan: resolved.plan,
    billingCycle: resolved.billingCycle,
    amountCents: Number(pick(data, [['order', 'amount'], ['amount']]) ?? 0),
    currency: String(pick(data, [['order', 'currency'], ['currency']]) ?? 'USD'),
    periodEnd,
    sourceType,
  }
}

function normalizeSubscriptionPaid(
  data: Record<string, unknown>,
  sourceType: string
): CreemEvent {
  const subscriptionId = asProductId(pick(data, [['id']]))
  const orderId =
    pick(data, [['last_transaction_id'], ['order', 'id'], ['order_id']]) ??
    (subscriptionId ? `${subscriptionId}:initial` : null)

  const buyerEmail = pick(data, [['customer', 'email'], ['email']])
  const productId = pick(data, [['product', 'id'], ['product']])
  const productName = pick(data, [['product', 'name']])
  const billingPeriod = pick(data, [['product', 'billing_period']])
  const resolved =
    resolveProduct(productId, productName, billingPeriod) ??
    resolveProductFromMetadata(data)

  const periodEnd = parseDate(
    pick(data, [
      ['current_period_end_date'],
      ['current_period_end'],
      ['next_transaction_date'],
    ])
  )

  if (!orderId || !buyerEmail || !resolved) {
    productResolutionError(sourceType, {
      order: orderId ?? 'missing',
      email: buyerEmail ? 'ok' : 'missing',
      productId: asProductId(productId) ?? 'missing',
      productName: productName ?? 'missing',
      billingPeriod: billingPeriod ?? 'missing',
    })
  }

  return {
    kind: 'paid',
    orderId: String(orderId),
    subscriptionId,
    buyerEmail: String(buyerEmail),
    plan: resolved.plan,
    billingCycle: resolved.billingCycle,
    amountCents: Number(pick(data, [['product', 'price'], ['amount']]) ?? 0),
    currency: String(pick(data, [['product', 'currency'], ['currency']]) ?? 'USD'),
    periodEnd,
    sourceType,
  }
}

/**
 * Maps a raw Creem webhook body to the internal event model.
 */
export function normalizeCreemEvent(body: unknown): CreemEvent {
  const root = body as Record<string, unknown>
  const type = String(root?.eventType ?? root?.type ?? '').toLowerCase()
  const data = (root?.object ?? root?.data ?? {}) as Record<string, unknown>

  if (type === 'checkout.completed') {
    return normalizeCheckoutCompleted(data, type)
  }

  if (type === 'subscription.paid') {
    return normalizeSubscriptionPaid(data, type)
  }

  if (
    type === 'subscription.active' ||
    type === 'subscription.trialing' ||
    type === 'subscription.update'
  ) {
    return { kind: 'ignored', type }
  }

  const subscriptionId = pick(data, [
    ['subscription', 'id'],
    ['subscription_id'],
    ['id'],
  ])

  if (
    type === 'subscription.canceled' ||
    type === 'subscription.cancelled' ||
    type === 'subscription.expired' ||
    type === 'subscription.scheduled_cancel'
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
