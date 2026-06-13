import type { Metadata } from 'next'
import { PolicyLayout } from '@/components/site/policy-layout'
import { BreadcrumbJsonLd } from '@/components/site/seo'

export const metadata: Metadata = { title: 'Terms of Service', description: 'Terms of Service for FormAlert for Slack.', alternates: { canonical: '/terms' } }

export default function TermsPage() {
  return (
    <>
      <BreadcrumbJsonLd items={[{ name: 'Home', path: '/' }, { name: 'Terms', path: '/terms' }]} />
      <PolicyLayout eyebrow="Terms of service" title="Terms for using FormAlert." description="These terms describe the responsibilities that come with installing, purchasing, and using FormAlert for Slack.">
        <h2>Product scope</h2><p>FormAlert is a Google Forms Editor Add-on that evaluates field-based rules and sends matching notifications to a Slack Incoming Webhook configured by the user.</p>
        <h2>Your responsibilities</h2><p>You are responsible for your Google Form, Slack workspace, Webhook configuration, message content, permissions, and compliance with applicable policies.</p>
        <h2>License Codes</h2><p>Paid features are activated with a License Code. Do not publicly share or resell a License Code. Installation limits depend on the purchased plan.</p>
        <h2>Service availability</h2><p>We work to keep license verification and support available, but Google Apps Script, Google Forms, Slack, and payment-provider availability are outside our control.</p>
        <h2>Acceptable use</h2><p>Do not use FormAlert for unauthorized access, harmful content, spam, or activity that violates Google, Slack, or applicable law.</p>
        <h2>Changes</h2><p>We may update these terms as the product evolves. Material changes will be reflected on this page.</p>
      </PolicyLayout>
    </>
  )
}
