import { ArrowRight, Bell, List, ShieldCheck } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { footerGroups, primaryNav, siteConfig } from './config'

export function Logo() {
  return (
    <span className="brand">
      <span className="brand-mark"><Bell weight="fill" /></span>
      <span><strong>FormAlert</strong> <em>for Slack</em></span>
    </span>
  )
}

export function ButtonLink({
  href,
  children,
  variant = 'primary',
  external = false,
}: {
  href: string
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'text'
  external?: boolean
}) {
  const className = `button button-${variant}`
  if (external) {
    return <a className={className} href={href} rel="noreferrer">{children}</a>
  }
  return <Link className={className} href={href}>{children}</Link>
}

export function MarketingHeader() {
  return (
    <header className="marketing-header">
      <Link href="/" aria-label="FormAlert home"><Logo /></Link>
      <nav aria-label="Primary navigation">
        {primaryNav.map((item) => <Link href={item.href} key={item.href}>{item.label}</Link>)}
        <details className="mobile-menu">
          <summary aria-label="Open navigation"><List /></summary>
          <div>{primaryNav.map((item) => <Link href={item.href} key={item.href}>{item.label}</Link>)}</div>
        </details>
      </nav>
      <ButtonLink href={siteConfig.marketplaceUrl}>Get FormAlert App <ArrowRight /></ButtonLink>
    </header>
  )
}

export function MarketingFooter() {
  return (
    <footer className="marketing-footer">
      <div className="footer-intro">
        <Logo />
        <p>Filtered Slack notifications for Google Forms, processed inside your Apps Script environment.</p>
        <span><ShieldCheck weight="fill" /> We do not store form responses.</span>
      </div>
      {footerGroups.map((group) => (
        <div className="footer-group" key={group.title}>
          <strong>{group.title}</strong>
          {group.links.map((item) => <Link href={item.href} key={item.href}>{item.label}</Link>)}
        </div>
      ))}
    </footer>
  )
}
