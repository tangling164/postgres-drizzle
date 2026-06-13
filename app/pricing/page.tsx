import type { Metadata } from 'next'
import { FAQAccordion } from '@/components/site/faq'
import { LicenseFlow, PageHero, SectionHeading } from '@/components/site/content'
import { PricingSection } from '@/components/site/pricing'
import { BreadcrumbJsonLd } from '@/components/site/seo'

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Compare Free, Standard, and Business plans for FormAlert for Slack. Monthly and yearly billing available.',
  alternates: { canonical: '/pricing' },
}

export default function PricingPage() {
  return (
    <main>
      <div className="page-container pricing-page-intro">
        <BreadcrumbJsonLd items={[{ name: 'Home', path: '/' }, { name: 'Pricing', path: '/pricing' }]} />
        <PageHero eyebrow="Pricing" title="Simple pricing for filtered Form alerts." description="Compare Free, Standard, and Business plans, then choose the limits that fit your workflows." align="center" />
      </div>
      <PricingSection />
      <div className="page-container">
        <section className="content-section license-section">
          <SectionHeading eyebrow="No web account required" title="Purchase on the web. Activate in the add-on." />
          <LicenseFlow />
        </section>
        <section className="content-section narrow-section">
          <SectionHeading eyebrow="Pricing FAQ" title="Questions before upgrading." />
          <FAQAccordion limit={5} />
        </section>
      </div>
    </main>
  )
}
