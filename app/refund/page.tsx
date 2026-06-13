import type { Metadata } from 'next'
import { PolicyLayout } from '@/components/site/policy-layout'
import { ButtonLink } from '@/components/site/site-shell'
import { BreadcrumbJsonLd } from '@/components/site/seo'

export const metadata: Metadata = { title: 'Refund Policy', description: 'FormAlert paid plans include a 5-day easy refund policy.', alternates: { canonical: '/refund' } }

export default function RefundPage() {
  return (
    <>
      <BreadcrumbJsonLd items={[{ name: 'Home', path: '/' }, { name: 'Refund Policy', path: '/refund' }]} />
      <PolicyLayout eyebrow="Refund policy" title="Paid plans include a 5-day easy refund policy." description="Try the paid plan in your Google Form. If it is not a fit, contact Support within five days of the initial purchase.">
        <h2>Eligibility</h2><p>Standard and Business purchases are eligible for a refund request within five calendar days of the initial purchase. Free plans do not require payment and are not eligible.</p>
        <h2>How to request a refund</h2><p>Contact Support with your payment email, order identifier, purchased plan, and reason for the request. Do not include your Slack Webhook URL or form response data.</p>
        <h2>Subscriptions</h2><p>Canceling a subscription prevents future renewal. Refund eligibility for the initial payment remains subject to the five-day window.</p>
        <h2>After a refund</h2><p>The related License Code may be deactivated when a refund is processed.</p>
        <ButtonLink href="/support">Request support</ButtonLink>
      </PolicyLayout>
    </>
  )
}
