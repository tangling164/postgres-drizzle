import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Info,
  LockKey,
  PaperPlaneTilt,
  ShieldCheck,
} from '@phosphor-icons/react/dist/ssr'
import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'

export function PageHero({
  eyebrow,
  title,
  description,
  children,
  align = 'left',
}: {
  eyebrow: string
  title: string
  description: string
  children?: ReactNode
  align?: 'center' | 'left'
}) {
  return (
    <section className={`page-hero page-hero-${align}`}>
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
      {children && <div className="hero-actions">{children}</div>}
    </section>
  )
}

export function SectionHeading({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return (
    <div className="section-heading">
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
  )
}

export function PluginScreenshot({
  src,
  alt,
  caption,
  priority = false,
}: {
  src: string
  alt: string
  caption: string
  priority?: boolean
}) {
  return (
    <figure className="plugin-screenshot">
      <Image src={src} alt={alt} width={844} height={1024} priority={priority} loading={priority ? undefined : 'eager'} />
      <figcaption>{caption}</figcaption>
    </figure>
  )
}

export function WorkflowSteps({ items }: { items: Array<{ title: string; text: string }> }) {
  return (
    <ol className="workflow-steps">
      {items.map((item, index) => (
        <li key={item.title}>
          <span>{index + 1}</span>
          <div><strong>{item.title}</strong><p>{item.text}</p></div>
        </li>
      ))}
    </ol>
  )
}

export function FeatureList({
  items,
  variant = 'capabilities',
}: {
  items: Array<{ icon: ReactNode; title: string; text: string }>
  variant?: 'capabilities' | 'use-cases'
}) {
  return (
    <div className={`feature-list feature-list-${variant}`}>
      {items.map((item) => (
        <article key={item.title}>
          <span>{item.icon}</span>
          <div><h3>{item.title}</h3><p>{item.text}</p></div>
        </article>
      ))}
    </div>
  )
}

export function Callout({
  title,
  children,
  kind = 'info',
}: {
  title: string
  children: ReactNode
  kind?: 'info' | 'privacy' | 'success'
}) {
  const icons = {
    info: <Info weight="fill" />,
    privacy: <LockKey weight="fill" />,
    success: <CheckCircle weight="fill" />,
  }
  return <aside className={`callout callout-${kind}`}>{icons[kind]}<div><strong>{title}</strong><div>{children}</div></div></aside>
}

export function GuideStep({
  number,
  title,
  description,
  children,
}: {
  number: number
  title: string
  description: string
  children?: ReactNode
}) {
  return (
    <section className="guide-step" id={`step-${number}`}>
      <span className="guide-step-number">{number}</span>
      <div><h2>{title}</h2><p>{description}</p>{children}</div>
    </section>
  )
}

export function DocsNavigation({ previous, next }: { previous?: { href: string; label: string }; next?: { href: string; label: string } }) {
  return (
    <nav className="docs-navigation" aria-label="Documentation navigation">
      {previous ? <Link href={previous.href}><ArrowLeft /> <span><small>Previous</small>{previous.label}</span></Link> : <span />}
      {next ? <Link href={next.href}><span><small>Next</small>{next.label}</span><ArrowRight /></Link> : <span />}
    </nav>
  )
}

export function PrivacyStrip() {
  return (
    <section className="privacy-strip">
      <ShieldCheck weight="fill" />
      <div><strong>Your form data stays in your Google Apps Script environment.</strong><p>FormAlert does not store Google Form responses or Slack Webhook URLs. Matching notifications go directly from Apps Script to Slack.</p></div>
      <Link href="/privacy">Read privacy policy <ArrowRight /></Link>
    </section>
  )
}

export function LicenseFlow() {
  const steps = ['Choose a plan', 'Complete Creem checkout', 'Receive your License Code', 'Activate it inside the add-on']
  return (
    <ol className="license-flow">
      {steps.map((step, index) => <li key={step}><span>{index + 1}</span><strong>{step}</strong>{index < steps.length - 1 && <PaperPlaneTilt />}</li>)}
    </ol>
  )
}
