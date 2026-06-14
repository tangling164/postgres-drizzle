import { EnvelopeSimple, Lifebuoy, ShieldCheck } from '@phosphor-icons/react/dist/ssr'
import type { Metadata } from 'next'
import { PageHero } from '@/components/site/content'
import { siteConfig } from '@/components/site/config'
import { BreadcrumbJsonLd } from '@/components/site/seo'

export const metadata: Metadata = { title: 'Support', description: 'Get help with FormAlert setup, License Codes, subscriptions, and billing issues.', alternates: { canonical: '/support' } }

export default function SupportPage() {
  return (
    <main className="page-container narrow-section">
      <BreadcrumbJsonLd items={[{ name: 'Home', path: '/' }, { name: 'Support', path: '/support' }]} />
      <PageHero eyebrow="Support" title="Get help without sharing response data." description="Send the error message, setup step, and your plan. Never send a Slack Webhook URL or Google Form response content." />
      <div className="support-grid">
        <article><Lifebuoy weight="fill" /><h2>Setup help</h2><p>Review installation, Webhook, filter, payload, test, and trigger steps.</p><a href="/installation-guide">Open installation guide</a></article>
        <article><EnvelopeSimple weight="fill" /><h2>Contact Support</h2><p>For License Code replacements, billing questions, or unresolved setup issues.</p><a href={`mailto:${siteConfig.supportEmail}`}>{siteConfig.supportEmail}</a></article>
        <article><ShieldCheck weight="fill" /><h2>Safe support request</h2><p>Include screenshots with sensitive values hidden. Do not share responses or Webhook URLs.</p><a href="/privacy">Read privacy policy</a></article>
      </div>
    </main>
  )
}
