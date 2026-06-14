import type { Metadata } from 'next'
import { PolicyLayout } from '@/components/site/policy-layout'
import { ButtonLink } from '@/components/site/site-shell'
import { BreadcrumbJsonLd } from '@/components/site/seo'

export const metadata: Metadata = { title: 'Refund Policy', description: 'FormAlert subscription cancellation and payment dispute policy.', alternates: { canonical: '/refund' } }

export default function RefundPage() {
  return (
    <>
      <BreadcrumbJsonLd items={[{ name: 'Home', path: '/' }, { name: 'Refund Policy', path: '/refund' }]} />
      <PolicyLayout eyebrow="Refund policy" title="Payments are non-refundable." description="You can cancel a subscription at any time and keep paid access until the end of the current billing period.">
        <h2>Refund eligibility</h2><p>Standard and Business payments are non-refundable except where required by law or when FormAlert confirms a duplicate charge or billing error.</p>
        <h2>Subscriptions</h2><p>Canceling a subscription prevents future renewal. Your paid plan remains active until the end of the current billing period.</p>
        <h2>Billing errors and disputes</h2><p>Contact Support with your payment email, order identifier, and a description of the billing issue. Do not include your Slack Webhook URL or form response data.</p>
        <h2>Reversed payments</h2><p>If a payment is refunded, reversed, or disputed, the related License Code may be deactivated immediately.</p>
        <ButtonLink href="/support">Contact support</ButtonLink>
      </PolicyLayout>
    </>
  )
}
