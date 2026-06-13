import type { Metadata } from 'next'
import { Callout, DocsNavigation, PageHero, WorkflowSteps } from '@/components/site/content'
import { ButtonLink } from '@/components/site/site-shell'
import { BreadcrumbJsonLd } from '@/components/site/seo'

export const metadata: Metadata = {
  title: 'How to Send Google Forms Responses to Slack',
  description: 'A practical guide to sending filtered Google Forms responses to Slack from the Google Forms editor.',
  alternates: { canonical: '/guides/google-forms-to-slack' },
}

export default function GoogleFormsToSlackGuide() {
  return (
    <main className="page-container narrow-section">
      <BreadcrumbJsonLd items={[{ name: 'Home', path: '/' }, { name: 'Guides', path: '/guides/google-forms-to-slack' }, { name: 'Google Forms to Slack', path: '/guides/google-forms-to-slack' }]} />
      <PageHero eyebrow="Guide" title="How to send Google Forms responses to Slack without notification noise." description="Open FormAlert in the Google Forms editor, add a Slack Incoming Webhook, then use field rules so only important submissions reach the channel." />
      <article className="article-content">
        <h2>Why filter Google Forms notifications?</h2><p>Sending every response to Slack works at low volume. As submissions grow, useful alerts get buried. Field filters let the team see high-budget leads, high-priority feedback, or serious bug reports without forwarding every row.</p>
        <h2>The focused setup</h2><WorkflowSteps items={[
          { title: 'Open the Google Form', text: 'Open the Form you want to monitor in the Google Forms editor.' },
          { title: 'Add the Slack Webhook', text: 'Create an Incoming Webhook for the channel that should receive alerts.' },
          { title: 'Write a message or payload', text: 'Insert variables from the current Form questions.' },
          { title: 'Add a field filter', text: 'Choose equals, contains, or greater than, then test the latest response.' },
        ]} />
        <Callout title="Privacy-first data path" kind="privacy">The response is evaluated in Apps Script and matching notifications are sent directly to your Slack Webhook.</Callout>
        <h2>Example rules</h2><pre><code>{`Budget greater_than 5000\nPriority equals High\nMessage contains refund`}</code></pre>
        <h2>Next step</h2><p>Use the complete Installation Guide for Webhook setup, Message and Payload modes, trigger installation, and troubleshooting.</p>
        <ButtonLink href="/installation-guide">Open installation guide</ButtonLink>
      </article>
      <DocsNavigation previous={{ href: '/faq', label: 'Frequently asked questions' }} />
    </main>
  )
}
