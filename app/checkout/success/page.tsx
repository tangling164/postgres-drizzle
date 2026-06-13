import { CheckCircle, ClipboardText, EnvelopeSimple, PuzzlePiece } from '@phosphor-icons/react/dist/ssr'
import type { Metadata } from 'next'
import { Callout, PageHero, PluginScreenshot, WorkflowSteps } from '@/components/site/content'
import { ButtonLink } from '@/components/site/site-shell'
import { BreadcrumbJsonLd } from '@/components/site/seo'

export const metadata: Metadata = { title: 'License Code Delivery', description: 'Learn how FormAlert License Codes are delivered and activated after checkout.', alternates: { canonical: '/checkout/success' }, robots: { index: false, follow: false } }

export default function CheckoutSuccessPage() {
  return (
    <main className="page-container narrow-section">
      <BreadcrumbJsonLd items={[{ name: 'Home', path: '/' }, { name: 'License Code Delivery', path: '/checkout/success' }]} />
      <PageHero eyebrow="License delivery" title="Your License Code unlocks the paid plan inside FormAlert." description="After a successful Creem checkout, the License Code appears on the success page and is sent to the payment email." align="center" />
      <Callout title="Checkout integration placeholder" kind="info">The frontend currently demonstrates the delivery flow. A real License Code will be inserted here after the Creem webhook and license service are implemented.</Callout>
      <div className="license-code"><ClipboardText weight="fill" /><div><small>Example License Code</small><strong>FA-8K2L-93JD-PRO</strong></div></div>
      <WorkflowSteps items={[
        { title: 'Copy the License Code', text: 'Copy it from the payment success page or delivery email.' },
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
