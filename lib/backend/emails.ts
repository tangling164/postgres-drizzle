/**
 * Transactional emails via the Resend REST API (Full_Backend_Spec v4.1 §4.4 /
 * §5.2 邮件模板). Called outside DB transactions; callers decide whether a
 * delivery failure should trigger a webhook retry.
 *
 * Uses fetch against api.resend.com directly — no SDK dependency needed for
 * a single endpoint (v4.1 cost discipline). Runtime copy is English-only.
 */

const RESEND_API_URL = 'https://api.resend.com/emails'

interface SendEmailInput {
  to: string
  subject: string
  html: string
}

export class EmailDeliveryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EmailDeliveryError'
  }
}

async function sendEmail({ to, subject, html }: SendEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  if (!apiKey || !from) {
    // Local development without Resend configured: log instead of failing,
    // so webhook flows remain testable end-to-end.
    console.warn(`[email:skipped] to=${to} subject="${subject}"`)
    return
  }

  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: `FormAlert <${from}>`, to: [to], subject, html }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new EmailDeliveryError(
      `Resend responded ${response.status}: ${detail.slice(0, 300)}`
    )
  }
}

function supportEmail(): string {
  return process.env.SUPPORT_EMAIL ?? 'support@formalert.app'
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'https://formalert.app'
}

function layout(body: string): string {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#f6f7f9;font-family:Arial,Helvetica,sans-serif;color:#1c1f23;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e4e7ec;border-radius:8px;padding:32px;">
    <p style="margin:0 0 24px;font-size:18px;font-weight:bold;">FormAlert for Slack</p>
    ${body}
    <hr style="border:none;border-top:1px solid #e4e7ec;margin:32px 0 16px;" />
    <p style="font-size:12px;color:#667085;margin:0;">
      Need help? Contact <a href="mailto:${supportEmail()}" style="color:#3056d3;">${supportEmail()}</a>
      &middot; <a href="${siteUrl()}" style="color:#3056d3;">formalert.app</a>
    </p>
  </div>
</body>
</html>`
}

const PLAN_LABELS: Record<string, string> = {
  standard: 'Standard',
  business: 'Business',
}

/** §4.4 — sent after order.paid creates a pending license. */
export async function sendLicenseEmail(input: {
  to: string
  licenseCode: string
  plan: string
  billingCycle: string
}): Promise<void> {
  const planLabel = PLAN_LABELS[input.plan] ?? input.plan
  await sendEmail({
    to: input.to,
    subject: `Your FormAlert ${planLabel} license code`,
    html: layout(`
      <p style="font-size:15px;line-height:1.6;">Thanks for purchasing the <strong>FormAlert ${planLabel}</strong> plan (${input.billingCycle}). Here is your license code:</p>
      <p style="font-size:22px;font-weight:bold;letter-spacing:1px;background:#f2f4f7;border-radius:6px;padding:16px;text-align:center;">${input.licenseCode}</p>
      <p style="font-size:15px;line-height:1.6;">To activate:</p>
      <ol style="font-size:15px;line-height:1.8;padding-left:20px;">
        <li>Open your Google Form and launch the FormAlert add-on.</li>
        <li>Go to <strong>Settings &rarr; License</strong>.</li>
        <li>Paste the code above and click <strong>Activate</strong>.</li>
      </ol>
      <p style="font-size:14px;line-height:1.6;color:#475467;">Keep this email — the code is shown only here and can be activated on one Google account at a time.</p>
    `),
  })
}

/** §5.2 邮件模板 1 — subscription cancelled, effective at period end. */
export async function sendCancellationScheduledEmail(input: {
  to: string
  plan: string
  periodEnd: Date
}): Promise<void> {
  const planLabel = PLAN_LABELS[input.plan] ?? input.plan
  const endDate = input.periodEnd.toISOString().slice(0, 10)
  await sendEmail({
    to: input.to,
    subject: `Your FormAlert ${planLabel} subscription has been cancelled`,
    html: layout(`
      <p style="font-size:15px;line-height:1.6;">Your <strong>FormAlert ${planLabel}</strong> subscription has been cancelled and will not renew.</p>
      <p style="font-size:15px;line-height:1.6;">You keep full ${planLabel} access until <strong>${endDate}</strong>. After that date your account moves to the Free tier and notifications beyond the Free limits will pause.</p>
      <p style="font-size:15px;line-height:1.6;">Changed your mind? You can purchase a new plan at any time and reactivate with a new license code.</p>
    `),
  })
}

/** §5.2 邮件模板 2 — downgrade executed at period end. */
export async function sendDowngradeExecutedEmail(input: {
  to: string
  previousPlan: string
}): Promise<void> {
  const planLabel = PLAN_LABELS[input.previousPlan] ?? input.previousPlan
  await sendEmail({
    to: input.to,
    subject: 'Your FormAlert plan has changed to Free',
    html: layout(`
      <p style="font-size:15px;line-height:1.6;">Your <strong>FormAlert ${planLabel}</strong> period has ended, and your account is now on the <strong>Free</strong> tier.</p>
      <p style="font-size:15px;line-height:1.6;">What this means:</p>
      <ul style="font-size:15px;line-height:1.8;padding-left:20px;">
        <li>Notifications above the Free tier limits are paused (nothing is deleted).</li>
        <li>Your alert rules and settings are kept exactly as you left them.</li>
        <li>Activating a new license instantly restores your paused notifications.</li>
      </ul>
      <p style="font-size:15px;line-height:1.6;"><a href="${siteUrl()}/pricing" style="color:#3056d3;font-weight:bold;">View plans &amp; reactivate</a></p>
    `),
  })
}

/** §4.2 payment.failed — renewal payment problem warning. */
export async function sendPaymentFailedEmail(input: {
  to: string
  plan: string
}): Promise<void> {
  const planLabel = PLAN_LABELS[input.plan] ?? input.plan
  await sendEmail({
    to: input.to,
    subject: 'Action needed: FormAlert renewal payment failed',
    html: layout(`
      <p style="font-size:15px;line-height:1.6;">We could not process the renewal payment for your <strong>FormAlert ${planLabel}</strong> subscription.</p>
      <p style="font-size:15px;line-height:1.6;">Please update your payment method in the Creem customer portal (link in your original receipt email). If payment is not completed, your plan will downgrade to Free at the end of the current period.</p>
    `),
  })
}
