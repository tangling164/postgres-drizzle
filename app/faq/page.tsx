import type { Metadata } from 'next'
import { FAQAccordion, faqItems } from '@/components/site/faq'
import { ButtonLink } from '@/components/site/site-shell'
import { PageHero } from '@/components/site/content'
import { BreadcrumbJsonLd, JsonLd } from '@/components/site/seo'

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Answers about FormAlert setup, License Codes, privacy, Slack Block Kit payloads, filter rules, plans, and refunds.',
  alternates: { canonical: '/faq' },
}

export default function FAQPage() {
  return (
    <main className="page-container narrow-section">
      <BreadcrumbJsonLd items={[{ name: 'Home', path: '/' }, { name: 'FAQ', path: '/faq' }]} />
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqItems.map(([name, text]) => ({ '@type': 'Question', name, acceptedAnswer: { '@type': 'Answer', text } })) }} />
      <PageHero eyebrow="FAQ" title="Straight answers about setup, privacy, and payment." description="FormAlert is intentionally narrow: core work happens inside the add-on, while the website handles guidance and License Code delivery." />
      <FAQAccordion />
      <section className="support-cta"><h2>Still need help?</h2><p>Include the error message, your plan, and the step where setup stopped. Never send your Slack Webhook URL or form response content.</p><ButtonLink href="/support">Contact support</ButtonLink></section>
    </main>
  )
}
