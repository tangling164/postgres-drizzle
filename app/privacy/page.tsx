import type { Metadata } from 'next'
import { PolicyLayout } from '@/components/site/policy-layout'
import { BreadcrumbJsonLd } from '@/components/site/seo'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'FormAlert does not store Google Form responses or Slack Webhook URLs. Learn how data is processed and what billing information is stored.',
  alternates: { canonical: '/privacy' },
}

export default function PrivacyPage() {
  return (
    <>
      <BreadcrumbJsonLd items={[{ name: 'Home', path: '/' }, { name: 'Privacy', path: '/privacy' }]} />
      <PolicyLayout eyebrow="Privacy policy" title="We do not store Google Form responses." description="FormAlert keeps response processing in your Google Apps Script environment and sends matching notifications directly to your Slack Webhook.">
        <h2>What FormAlert accesses</h2><p>The add-on accesses questions and responses from the current Google Form only when needed to configure, test, and run your local rules.</p>
        <h2>What FormAlert does not store</h2><ul><li>Google Form responses</li><li>Slack Webhook URLs</li><li>Slack message or payload templates</li><li>Customer names, emails, budgets, messages, or other response values</li></ul>
        <h2>How notifications are sent</h2><p>Rules are evaluated in your Google Apps Script environment. Matching notifications are sent directly from Apps Script to your configured Slack Webhook.</p>
        <h2>What our server stores</h2><p>Our server stores license and billing-related information needed to deliver and validate paid plans, including a non-reversible License Code hash, buyer email, Google account identifier and email, plan, billing cycle, status, and validity dates. Plaintext License Codes are delivered by email and are not stored.</p>
        <h2>Local logs</h2><p>Recent delivery logs are stored locally by the add-on. They must not contain complete form responses or Slack Webhook URLs.</p>
        <h2>Contact</h2><p>Contact Support for privacy questions or deletion requests related to license and billing information.</p>
      </PolicyLayout>
    </>
  )
}
