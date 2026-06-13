import {
  ArrowRight,
  Bug,
  ChartLineUp,
  CheckCircle,
  Code,
  FunnelSimple,
  PaperPlaneTilt,
  UsersThree,
} from '@phosphor-icons/react/dist/ssr'
import type { Metadata } from 'next'
import { ButtonLink } from '@/components/site/site-shell'
import { FeatureList, PluginScreenshot, PrivacyStrip, SectionHeading, WorkflowSteps } from '@/components/site/content'
import { PricingSection } from '@/components/site/pricing'
import { SoftwareApplicationJsonLd } from '@/components/site/seo'
import { siteConfig } from '@/components/site/config'

export const metadata: Metadata = {
  title: 'Filtered Slack notifications for Google Forms',
  description: 'Add field-based filters to Google Forms Slack notifications. Send only the responses that match your rules.',
  alternates: { canonical: '/' },
}

const features = [
  { icon: <FunnelSimple weight="fill" />, title: 'Filter Rules', text: 'Send only responses that match equals, contains, or greater-than field rules.' },
  { icon: <Code weight="fill" />, title: 'Message & Payload Mode', text: 'Write Markdown messages or paste official Slack Block Kit payload JSON.' },
  { icon: <CheckCircle weight="fill" />, title: 'Local Status & Debug', text: 'See the latest status and copy redacted debug info from the add-on.' },
]

const useCases = [
  { icon: <ChartLineUp weight="fill" />, title: 'Sales leads', text: 'Notify Slack when a lead meets your budget or qualification threshold.' },
  { icon: <UsersThree weight="fill" />, title: 'Customer feedback', text: 'Route high-priority feedback and refund requests to the right channel.' },
  { icon: <Bug weight="fill" />, title: 'Bug reports', text: 'Alert the team only when severity or impact matches your rule.' },
]

export default function HomePage() {
  return (
    <main>
      <SoftwareApplicationJsonLd />
      <section className="landing-hero">
        <div className="landing-hero-copy">
          <span className="eyebrow">Filtered Slack alerts for Google Forms</span>
          <h1>Send important form responses to Slack.</h1>
          <p>Add field rules in the current Google Form. Matching notifications go directly from Apps Script to your Slack Webhook.</p>
          <div className="hero-actions">
            <ButtonLink href={siteConfig.marketplaceUrl}>Get FormAlert App <PaperPlaneTilt weight="fill" /></ButtonLink>
            <ButtonLink href="/installation-guide" variant="secondary">View setup guide</ButtonLink>
          </div>
        </div>
        <PluginScreenshot src="/product/rule-editor.png" alt="FormAlert rule editor inside the Google Forms Editor Add-on" caption="Configure a field rule, message, and direct Slack delivery inside the add-on." priority />
      </section>

      <section className="content-section workflow-section">
        <SectionHeading eyebrow="One focused workflow" title="Filter before you notify." description="FormAlert adds one useful decision between a Google Forms submission and a Slack notification." />
        <div className="simple-flow"><span>Google Form</span><ArrowRight /><span>Field Filter</span><ArrowRight /><span>Slack notification</span></div>
      </section>

      <section className="content-section">
        <SectionHeading title="Everything needed to keep Slack useful." />
        <FeatureList items={features} variant="capabilities" />
      </section>

      <section className="content-section product-proof">
        <div>
          <span className="eyebrow">Inside the add-on</span>
          <h2>Core work stays with your Google Form.</h2>
          <p>Webhook setup, question selection, rules, tests, and local debug status all happen inside the Google Forms Editor Add-on. The website exists to help you install, learn, and upgrade.</p>
          <ButtonLink href="/installation-guide" variant="secondary">See the complete setup</ButtonLink>
        </div>
        <PluginScreenshot src="/product/delivery-logs.png" alt="FormAlert local status and debug controls" caption="Last status and redacted debug info stay local to the add-on." />
      </section>

      <section className="content-section">
        <SectionHeading title="Useful for the submissions your team needs to act on." />
        <FeatureList items={useCases} variant="use-cases" />
      </section>

      <section className="content-section setup-preview">
        <SectionHeading title="A short path from Google Form to Slack." />
        <WorkflowSteps items={[
          { title: 'Open the Google Form', text: 'Open the Form you want to monitor in the Forms editor.' },
          { title: 'Install FormAlert', text: 'Launch the add-on from the Forms editor add-on button.' },
          { title: 'Configure and filter', text: 'Add your Slack Webhook, message, and field rule.' },
          { title: 'Test and enable', text: 'Test with the latest response, then save to enable automatic alerts.' },
        ]} />
        <ButtonLink href="/installation-guide" variant="secondary">Read installation guide</ButtonLink>
      </section>

      <PrivacyStrip />

      <PricingSection />

      <section className="final-cta">
        <div><h2>Send the responses that deserve attention.</h2><p>Install FormAlert in your current Google Form and create your first field filter.</p></div>
        <ButtonLink href={siteConfig.marketplaceUrl}>Get FormAlert App <PaperPlaneTilt weight="fill" /></ButtonLink>
      </section>
    </main>
  )
}
