import type { Metadata } from 'next'
import { FAQAccordion } from '@/components/site/faq'
import { LicenseFlow, SectionHeading } from '@/components/site/content'
import { PricingSection } from '@/components/site/pricing'
import { BreadcrumbJsonLd } from '@/components/site/seo'

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Compare Free and Standard plans for FormAlert for Slack. Standard monthly and yearly billing is available.',
  alternates: { canonical: '/pricing' },
}

export default function PricingPage() {
  return (
    <main>
      <div className="page-container pricing-page-intro">
        <BreadcrumbJsonLd items={[{ name: 'Home', path: '/' }, { name: 'Pricing', path: '/pricing' }]} />
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
