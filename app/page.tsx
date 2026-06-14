import { ArrowRight, PaperPlaneTilt } from '@phosphor-icons/react/dist/ssr'
import type { Metadata } from 'next'
import { ButtonLink } from '@/components/site/site-shell'
import { PluginScreenshot, PrivacyStrip, SectionHeading } from '@/components/site/content'
import { PricingSection } from '@/components/site/pricing'
import { SoftwareApplicationJsonLd } from '@/components/site/seo'
import { siteConfig } from '@/components/site/config'

export const metadata: Metadata = {
  title: 'Filtered Slack notifications for Google Forms',
  description: 'Add field-based filters to Google Forms Slack notifications. Send only the responses that match your rules.',
  alternates: { canonical: '/' },
}

export default function HomePage() {
  return (
    <main>
      <SoftwareApplicationJsonLd />

      <section className="landing-hero-v2">
        <h1>Only notify Slack when a response matches.</h1>
        <p>Field-filtered alerts for Google Forms.</p>
        <div className="hero-actions hero-actions-centered">
          <ButtonLink href={siteConfig.marketplaceUrl}>Get FormAlert Free <PaperPlaneTilt weight="fill" /></ButtonLink>
          <ButtonLink href="#how-it-works" variant="secondary">See how it works</ButtonLink>
        </div>
        <div className="hero-video-wrap">
          {/* TODO: add /product/demo.mp4 when the walkthrough video is ready */}
          <video className="hero-video" controls preload="none" width={1720} height={967}>
            <source src="/product/demo.mp4" type="video/mp4" />
          </video>
        </div>
      </section>

      <section className="content-section workflow-section" id="how-it-works">
        <SectionHeading
          eyebrow="One focused workflow"
          title="Filter before you notify."
          description="FormAlert adds one useful decision between a Google Forms submission and a Slack notification."
        />
        <div className="simple-flow">
          <span>Google Form</span>
          <ArrowRight aria-hidden />
          <span>Field Filter</span>
          <ArrowRight aria-hidden />
          <span>Slack notification</span>
        </div>
      </section>

      <section className="how-it-works">
        <div className="how-it-works-inner">
          <h2 className="how-it-works-heading">It works in 3 simple steps</h2>
          <p className="how-it-works-lead">Install FormAlert, connect Slack, and optionally add a filter rule.</p>

          <div className="how-step">
            <div className="how-step-copy">
              <p className="how-step-num">Step 1</p>
              <h3>Install FormAlert</h3>
              <p>Open your Google Form, click Add-ons, and install FormAlert from the Marketplace.</p>
            </div>
            {/* TODO: replace with /product/addon-install.png once screenshot is available */}
            <PluginScreenshot
              src="/product/delivery-logs.png"
              alt="FormAlert running inside the Google Forms editor"
              caption="Install directly from the Google Forms editor Add-ons menu."
            />
          </div>

          <div className="how-step how-step-flipped">
            <div className="how-step-copy">
              <p className="how-step-num">Step 2</p>
              <h3>Add your Webhook</h3>
              <p>Paste your Slack Webhook URL and write your message. Done.</p>
            </div>
            {/* TODO: replace with webhook config screenshot once available */}
            <PluginScreenshot
              src="/product/license-activation.png"
              alt="FormAlert configuration screen showing Webhook URL and message fields"
              caption="Paste your Slack Webhook URL and write your notification message."
            />
          </div>

          <div className="how-step">
            <div className="how-step-copy">
              <p className="how-step-num">Step 3</p>
              <h3>Set a filter rule</h3>
              <p>Choose a field and a condition. FormAlert only notifies Slack when a response matches. Free plan works without this step.</p>
            </div>
            <PluginScreenshot
              src="/product/rule-editor.png"
              alt="FormAlert rule editor showing field, condition, and value configuration"
              caption="Add a rule to filter out responses that do not matter."
            />
          </div>

          <div className="how-it-works-actions">
            <ButtonLink href="/installation-guide" variant="secondary">Read installation guide</ButtonLink>
          </div>
        </div>
      </section>

      <PrivacyStrip />

      <PricingSection />

      <section className="final-cta">
        <div><h2>Send the responses your team needs to act on.</h2></div>
        <ButtonLink href={siteConfig.marketplaceUrl}>Get FormAlert Free <PaperPlaneTilt weight="fill" /></ButtonLink>
      </section>
    </main>
  )
}
