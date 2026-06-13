/**
 * Creem webhook event handlers (Full_Backend_Spec v4.1 §4.2 / §4.5 / §5.2).
 *
 * Idempotency model:
 * - First purchase: keyed on orders.creem_order_id. Renewals are detected by
 *   an existing license with the same creem_subscription_id, so a renewal
 *   never mints a second license even though Creem issues a new order id.
 * - Email retries: only the HMAC hash of a license code is stored, so a
 *   failed license email is retried by rotating the (still pending) code and
 *   re-sending — marked via orders.license_email_sent_at.
 * - Tombstones (§3.14): events for deleted accounts are swallowed with 200.
 */
import { getSql } from '@/lib/db/client'
import { CreemEvent } from '@/lib/backend/creem'
import { generateLicenseCode, hashLicenseCode } from '@/lib/backend/license'
import { BILLING_CYCLE_DAYS } from '@/lib/backend/plans'
import {
  sendCancellationScheduledEmail,
  sendDowngradeExecutedEmail,
  sendLicenseEmail,
  sendPaymentFailedEmail,
} from '@/lib/backend/emails'

function licensePepper(): string {
  const pepper = process.env.LICENSE_PEPPER
  if (!pepper) throw new Error('LICENSE_PEPPER is not configured')
  return pepper
}

async function isTombstonedSubscription(subscriptionId: string | null): Promise<boolean> {
  if (!subscriptionId) return false
  const sql = getSql()
  const rows = await sql`
    SELECT 1 FROM deleted_accounts
    WHERE creem_subscription_ids @> ARRAY[${subscriptionId}]::text[]
    LIMIT 1
  `
  return rows.length > 0
}

export async function handleCreemEvent(event: CreemEvent): Promise<{ note: string }> {
  switch (event.kind) {
    case 'paid':
      return handlePaid(event)
    case 'cancelled':
      return handleCancelled(event)
    case 'payment_failed':
      return handlePaymentFailed(event)
    case 'refund_or_dispute':
      return handleRefundOrDispute(event)
    case 'ignored':
      return { note: `ignored event type: ${event.type}` }
  }
}

async function handlePaid(
  event: Extract<CreemEvent, { kind: 'paid' }>
): Promise<{ note: string }> {
  const sql = getSql()

  if (await isTombstonedSubscription(event.subscriptionId)) {
    return { note: 'tombstoned subscription; event swallowed' }
  }

  // Renewal detection: an existing license on the same subscription means
  // this paid event extends the period instead of creating a new license.
  if (event.subscriptionId) {
    const existingLicenses = await sql`
      SELECT id FROM licenses
      WHERE creem_subscription_id = ${event.subscriptionId}
      LIMIT 1
    `
    if (existingLicenses.length > 0) {
      return handleRenewal(event)
    }
  }

  const fallbackValidUntil = new Date(
    Date.now() + BILLING_CYCLE_DAYS[event.billingCycle] * 24 * 60 * 60 * 1000
  )
  const validUntil = event.periodEnd ?? fallbackValidUntil

  const result = await sql.begin(async (tx) => {
    const existing = await tx`
      SELECT id, license_email_sent_at FROM orders
      WHERE creem_order_id = ${event.orderId}
      FOR UPDATE
    `

    if (existing.length > 0) {
      const order = existing[0]
      if (order.license_email_sent_at) {
        return { duplicate: true as const, orderId: order.id as string, code: null }
      }
      // Webhook retry after an email failure: rotate the pending code so the
      // user receives a working one (plaintext codes are never stored).
      const code = generateLicenseCode()
      const rotated = await tx`
        UPDATE licenses
        SET code_hash = ${hashLicenseCode(code, licensePepper())}
        WHERE order_id = ${order.id} AND status = 'pending'
        RETURNING id
      `
      if (rotated.length === 0) {
        // License left pending state (activated/revoked) — nothing to resend.
        return { duplicate: true as const, orderId: order.id as string, code: null }
      }
      return { duplicate: false as const, orderId: order.id as string, code }
    }

    const insertedOrders = await tx`
      INSERT INTO orders (
        creem_order_id, creem_subscription_id, buyer_email, plan,
        billing_cycle, amount_cents, currency, status
      ) VALUES (
        ${event.orderId}, ${event.subscriptionId}, ${event.buyerEmail}, ${event.plan},
        ${event.billingCycle}, ${event.amountCents}, ${event.currency}, 'completed'
      )
      RETURNING id
    `
    const orderId = insertedOrders[0].id as string

    const code = generateLicenseCode()
    await tx`
      INSERT INTO licenses (code_hash, order_id, plan, status, valid_until, creem_subscription_id)
      VALUES (
        ${hashLicenseCode(code, licensePepper())}, ${orderId}, ${event.plan},
        'pending', ${validUntil}, ${event.subscriptionId}
      )
    `
    return { duplicate: false as const, orderId, code }
  })

  if (result.duplicate || !result.code) {
    return { note: 'duplicate order event; already processed' }
  }

  // Outside the transaction: a Resend failure throws → route answers 500 →
  // Creem retries → the retry path above rotates the code and resends.
  await sendLicenseEmail({
    to: event.buyerEmail,
    licenseCode: result.code,
    plan: event.plan,
    billingCycle: event.billingCycle,
  })
  await sql`
    UPDATE orders SET license_email_sent_at = now(), updated_at = now()
    WHERE id = ${result.orderId}
  `
  return { note: 'order recorded, license generated, email sent' }
}

async function handleRenewal(
  event: Extract<CreemEvent, { kind: 'paid' }>
): Promise<{ note: string }> {
  const sql = getSql()
  const newValidUntil =
    event.periodEnd ??
    new Date(Date.now() + BILLING_CYCLE_DAYS[event.billingCycle] * 24 * 60 * 60 * 1000)

  return sql.begin(async (tx) => {
    const licenses = await tx`
      SELECT id, status, plan, activated_account_id, valid_until
      FROM licenses
      WHERE creem_subscription_id = ${event.subscriptionId}
      ORDER BY created_at DESC
      LIMIT 1
      FOR UPDATE
    `
    if (licenses.length === 0) {
      return { note: 'renewal for unknown subscription; ignored' }
    }
    const license = licenses[0]

    // Review v5 P1-02: a superseded/revoked license keeps its own period
    // bookkeeping but must never overwrite the account's current (higher)
    // entitlement. Only an `active` license propagates to the account.
    await tx`
      UPDATE licenses SET valid_until = ${newValidUntil}
      WHERE id = ${license.id}
    `

    if (license.status === 'active' && license.activated_account_id) {
      await tx`
        UPDATE accounts
        SET plan_expires_at = ${newValidUntil},
            entitlement_status = 'active',
            updated_at = now()
        WHERE id = ${license.activated_account_id} AND plan = ${license.plan}
      `
      return { note: 'renewal applied to active license and account' }
    }
    return { note: `renewal applied to ${license.status} license only` }
  })
}

async function handleCancelled(
  event: Extract<CreemEvent, { kind: 'cancelled' }>
): Promise<{ note: string }> {
  const sql = getSql()

  if (await isTombstonedSubscription(event.subscriptionId)) {
    return { note: 'tombstoned subscription; event swallowed' }
  }

  const rows = await sql`
    UPDATE licenses
    SET cancel_at_period_end = true, cancelled_at = now()
    WHERE creem_subscription_id = ${event.subscriptionId}
      AND status IN ('pending', 'active')
    RETURNING id, plan, valid_until, order_id
  `
  if (rows.length === 0) {
    return { note: 'cancel for unknown/closed subscription; ignored' }
  }

  const license = rows[0]
  const orders = await sql`
    SELECT buyer_email FROM orders WHERE id = ${license.order_id} LIMIT 1
  `
  if (orders.length > 0 && license.valid_until) {
    await sendCancellationScheduledEmail({
      to: orders[0].buyer_email,
      plan: license.plan,
      periodEnd: license.valid_until,
    })
  }
  return { note: 'cancellation recorded; downgrade scheduled at period end' }
}

async function handlePaymentFailed(
  event: Extract<CreemEvent, { kind: 'payment_failed' }>
): Promise<{ note: string }> {
  const sql = getSql()

  if (await isTombstonedSubscription(event.subscriptionId)) {
    return { note: 'tombstoned subscription; event swallowed' }
  }

  let buyerEmail = event.buyerEmail
  let plan = 'standard'

  if (event.subscriptionId) {
    const rows = await sql`
      SELECT l.plan, l.status, l.activated_account_id, o.buyer_email
      FROM licenses l
      JOIN orders o ON o.id = l.order_id
      WHERE l.creem_subscription_id = ${event.subscriptionId}
      ORDER BY l.created_at DESC
      LIMIT 1
    `
    if (rows.length > 0) {
      buyerEmail = buyerEmail ?? rows[0].buyer_email
      plan = rows[0].plan
      if (rows[0].status === 'active' && rows[0].activated_account_id) {
        // Grace period: mark the issue but keep paid access until period end.
        await sql`
          UPDATE accounts SET entitlement_status = 'payment_issue', updated_at = now()
          WHERE id = ${rows[0].activated_account_id}
        `
      }
    }
  }

  if (buyerEmail) {
    await sendPaymentFailedEmail({ to: buyerEmail, plan })
  }
  return { note: 'payment failure recorded' }
}

async function handleRefundOrDispute(
  event: Extract<CreemEvent, { kind: 'refund_or_dispute' }>
): Promise<{ note: string }> {
  const sql = getSql()

  const result = await sql.begin(async (tx) => {
    const orders = await tx`
      SELECT id, buyer_email, plan FROM orders
      WHERE creem_order_id = ${event.orderId}
      FOR UPDATE
    `
    if (orders.length === 0) {
      return { found: false as const, buyerEmail: null, plan: null }
    }
    const order = orders[0]

    await tx`
      UPDATE orders SET status = ${event.disposition}, updated_at = now()
      WHERE id = ${order.id}
    `

    const licenses = await tx`
      UPDATE licenses
      SET status = 'revoked', cancelled_at = now()
      WHERE order_id = ${order.id} AND status IN ('pending', 'active')
      RETURNING activated_account_id
    `

    // Review v5 P1-01: clear the cached plan as well, so the display cache
    // can never disagree with the revoked license.
    for (const license of licenses) {
      if (license.activated_account_id) {
        await tx`
          UPDATE accounts
          SET plan = 'free', plan_expires_at = NULL,
              entitlement_status = 'revoked', updated_at = now()
          WHERE id = ${license.activated_account_id}
        `
      }
    }

    return {
      found: true as const,
      buyerEmail: order.buyer_email as string,
      plan: order.plan as string,
    }
  })

  if (!result.found) {
    return { note: 'refund for unknown order; ignored' }
  }
  if (result.buyerEmail && result.plan) {
    await sendDowngradeExecutedEmail({
      to: result.buyerEmail,
      previousPlan: result.plan,
    })
  }
  return { note: `${event.disposition} processed; license revoked` }
}
