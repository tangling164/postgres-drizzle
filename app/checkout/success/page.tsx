import { CheckCircle, EnvelopeSimple, PuzzlePiece } from '@phosphor-icons/react/dist/ssr'
import type { Metadata } from 'next'
import { Callout, PageHero, PluginScreenshot, WorkflowSteps } from '@/components/site/content'
import { ButtonLink } from '@/components/site/site-shell'
import { BreadcrumbJsonLd } from '@/components/site/seo'

export const metadata: Metadata = { title: 'License Code Delivery', description: 'Learn how FormAlert License Codes are delivered and activated after checkout.', alternates: { canonical: '/checkout/success' }, robots: { index: false, follow: false } }

export default function CheckoutSuccessPage() {
  return (
    <main className="page-container narrow-section">
      <BreadcrumbJsonLd items={[{ name: 'Home', path: '/' }, { name: 'License Code Delivery', path: '/checkout/success' }]} />
      <PageHero eyebrow="License delivery" title="Check your email for your License Code." description="After a successful Creem checkout, FormAlert sends the License Code to the payment email. It is not displayed or stored on this page." align="center" />
      <Callout title="Email can take a few minutes" kind="info">Check your spam or junk folder if the License Code email does not arrive. Contact Support with your payment email and order details if you still need help.</Callout>
      <WorkflowSteps items={[
        { title: 'Open the delivery email', text: 'Copy the License Code sent to the email used during Creem checkout.' },
        { title: 'Open FormAlert', text: 'Return to the Google Form and open the add-on from the Forms editor.' },
        { title: 'Open License', text: 'Paste the code into the License section.' },
        { title: 'Activate your plan', text: 'The add-on verifies the code and applies your plan limits.' },
      ]} />
      <PluginScreenshot src="/product/license-activation.png" alt="FormAlert License Code activation screen" caption="License activation happens inside the add-on, not in a web account." />
      <div className="success-actions"><ButtonLink href="/installation-guide" variant="secondary"><PuzzlePiece /> Open setup guide</ButtonLink><ButtonLink href="/support" variant="text"><EnvelopeSimple /> Get support</ButtonLink></div>
      <p className="center-note"><CheckCircle weight="fill" /> The payment email does not need to match your Google account email.</p>
    </main>
  )
}
