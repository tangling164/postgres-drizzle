import { Code, FunnelSimple, LinkSimple, PaperPlaneTilt, Play, SlackLogo } from '@phosphor-icons/react/dist/ssr'
import type { Metadata } from 'next'
import { ButtonLink } from '@/components/site/site-shell'
import { BreadcrumbJsonLd } from '@/components/site/seo'
import { Callout, DocsNavigation, GuideStep, PageHero, PluginScreenshot } from '@/components/site/content'
import { siteConfig } from '@/components/site/config'

export const metadata: Metadata = {
  title: 'Installation Guide',
  description: 'Install FormAlert in the Google Forms editor, connect Slack, create a filter rule, and test your first notification.',
  alternates: { canonical: '/installation-guide' },
}

const toc = [
  'Open your Google Form',
  'Install and open FormAlert from Forms',
  'Create a Slack Incoming Webhook',
  'Configure Message or Payload Mode',
  'Create a Filter Rule',
  'Test the latest response',
  'Install the trigger',
  'Troubleshoot common errors',
]

export default function InstallationGuidePage() {
  return (
    <main className="page-container docs-page">
      <BreadcrumbJsonLd items={[{ name: 'Home', path: '/' }, { name: 'Installation Guide', path: '/installation-guide' }]} />
      <PageHero eyebrow="Installation guide" title="From Google Form to filtered Slack alert." description="Follow this guide inside the Google Forms editor. Most users can configure their first rule in a few focused steps.">
        <ButtonLink href={siteConfig.marketplaceUrl}>Get FormAlert App</ButtonLink>
      </PageHero>
      <div className="docs-layout">
        <aside className="docs-toc"><strong>On this page</strong>{toc.map((item, index) => <a href={`#step-${index + 1}`} key={item}>{index + 1}. {item}</a>)}</aside>
        <article className="docs-content">
          <GuideStep number={1} title="Open your Google Form" description="Create or open the Google Form whose submissions should be filtered before they reach Slack.">
            <Callout title="Current Form only" kind="privacy">FormAlert does not browse Google Drive or read all of your Google Forms.</Callout>
          </GuideStep>
          <GuideStep number={2} title="Install and open FormAlert from Forms" description="Install the add-on, reload the Form editor, then launch FormAlert from the top-right add-on button.">
            <ButtonLink href={siteConfig.marketplaceUrl} variant="secondary">Get FormAlert App</ButtonLink>
          </GuideStep>
          <GuideStep number={3} title="Create a Slack Incoming Webhook" description="Create an Incoming Webhook in Slack, copy its URL, and paste it into FormAlert. Save and test the connection.">
            <Callout title="Webhook privacy" kind="privacy">The Webhook URL is saved in your Apps Script PropertiesService, not on FormAlert servers.</Callout>
          </GuideStep>
          <GuideStep number={4} title="Configure Message or Payload Mode" description="Use Message Mode for a Markdown notification, or paste JSON from Slack Block Kit Builder into Payload Mode. Insert fields such as {{Name}} or {{Budget}}.">
            <div className="mode-grid"><div><SlackLogo weight="fill" /><strong>Message Mode</strong><p>Write a readable Slack message with Form question variables.</p></div><div><Code weight="fill" /><strong>Payload Mode</strong><p>Validate official Slack Block Kit payload JSON before sending.</p></div></div>
          </GuideStep>
          <GuideStep number={5} title="Create a Filter Rule" description="Choose a field, select equals, contains, or greater than, then enter the value that should trigger Slack.">
            <PluginScreenshot src="/product/rule-editor.png" alt="FormAlert filter rule editor" caption="A field rule is evaluated locally before FormAlert sends to Slack." />
          </GuideStep>
          <GuideStep number={6} title="Test the latest response" description="Run the current rule against the latest response. FormAlert shows whether it matched, renders the message, and sends the test directly to Slack.">
            <Callout title="Tests stay local" kind="privacy">Latest response data is processed in Apps Script and is not uploaded to FormAlert servers.</Callout>
          </GuideStep>
          <GuideStep number={7} title="Enable automatic alerts" description="Save your first Form alert. FormAlert enables automatic delivery so each new response is filtered automatically.">
            <div className="icon-line"><Play weight="fill" /><span>New response</span><LinkSimple /><span>Local rule check</span><FunnelSimple /><span>Slack alert</span><PaperPlaneTilt weight="fill" /></div>
          </GuideStep>
          <GuideStep number={8} title="Troubleshoot common errors" description="Check the next action shown in the add-on when a Webhook, field, payload, License Code, or trigger needs attention.">
            <ul className="check-list"><li>Confirm the Webhook starts with https://hooks.slack.com/services/</li><li>Refresh fields if Form questions changed</li><li>Validate Payload JSON after inserting variables</li><li>Submit one Form response before using Send Test</li><li>Open Support if a License Code needs manual reset</li></ul>
          </GuideStep>
          <DocsNavigation next={{ href: '/faq', label: 'Frequently asked questions' }} />
        </article>
      </div>
    </main>
  )
}
