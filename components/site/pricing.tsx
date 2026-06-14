'use client'

import { Check, ShieldCheck } from '@phosphor-icons/react'
import { useState } from 'react'
import { siteConfig } from './config'

type BillingCycle = 'monthly' | 'yearly'

interface PricingPlan {
  name: 'Free' | 'Standard' | 'Business'
  monthly: string
  yearly: string
  payment: string
  description: string
  features: readonly string[]
  featured?: boolean
  comingSoon?: boolean
}

const plans: readonly PricingPlan[] = [
  {
    name: 'Free',
    monthly: '$0',
    yearly: '$0',
    payment: 'No payment required',
    description: 'Try direct Slack delivery from your current Google Form.',
    features: ['7-day trial', '30 Slack sends total', '1 connected Google Form', 'Message Mode', 'No Filter Rules', 'Latest 10 redacted debug entries'],
  },
  {
    name: 'Standard',
    monthly: '$5',
    yearly: '$3.25',
    payment: '$39 billed yearly',
    description: 'For small teams filtering several Google Forms.',
    features: ['No FormAlert send limit*', 'Up to 20 connected Google Forms', 'Message & Payload Mode', 'Filter Rules', 'Up to 50 conditions per Form', 'Latest 10 redacted debug entries'],
    featured: true,
  },
  {
    name: 'Business',
    monthly: '',
    yearly: '',
    payment: '',
    description: 'A future plan for larger FormAlert deployments.',
    features: ['Plan details will be announced before launch.'],
    comingSoon: true,
  },
] as const

function checkoutUrl(name: string, cycle: BillingCycle): string | null {
  if (name === 'Standard') return cycle === 'monthly' ? siteConfig.checkout.standardMonthly : siteConfig.checkout.standardYearly
  return siteConfig.marketplaceUrl
}

export function PricingTable() {
  const [cycle, setCycle] = useState<BillingCycle>('yearly')

  return (
    <div className="pricing-table-wrap">
      <div className="section-heading pricing-table-heading">
        <h2 id="pricing-title">Start free, then upgrade with a License Code.</h2>
        <p>No web account is required. Purchase a plan, receive a License Code, and activate it inside the add-on.</p>
      </div>
      <div className="billing-toggle" aria-label="Billing cycle">
        <button aria-pressed={cycle === 'monthly'} className={cycle === 'monthly' ? 'active' : ''} onClick={() => setCycle('monthly')}>Monthly</button>
        <button aria-pressed={cycle === 'yearly'} className={cycle === 'yearly' ? 'active' : ''} onClick={() => setCycle('yearly')}>Yearly <span>Save up to 35%</span></button>
      </div>
      <div className="pricing-grid">
        {plans.map((plan) => {
          const checkout = checkoutUrl(plan.name, cycle)
          return (
            <article className={`pricing-card ${plan.featured ? 'featured' : ''}`} key={plan.name}>
              {plan.featured && <span className="popular">Most popular</span>}
              {plan.comingSoon && <span className="availability">Coming soon</span>}
              <h3>{plan.name}</h3>
              <p>{plan.description}</p>
              {plan.comingSoon
                ? <div className="plan-price"><strong>Coming soon</strong></div>
                : (
                  <>
                    <div className="plan-price"><strong>{cycle === 'monthly' ? plan.monthly : plan.yearly}</strong><span>/ month</span></div>
                    <small>{cycle === 'yearly' ? plan.payment : plan.name === 'Free' ? plan.payment : 'Billed monthly'}</small>
                  </>
                )}
              <ul>{plan.features.map((feature) => <li key={feature}><Check weight="bold" />{feature}</li>)}</ul>
              {plan.comingSoon
                ? <span className="button button-secondary button-unavailable" aria-disabled="true">Coming soon</span>
                : checkout
                  ? (
                    <a className={`button ${plan.featured ? 'button-primary' : 'button-secondary'}`} href={checkout}>
                      {plan.name === 'Free' ? 'Get FormAlert App' : `Choose ${plan.name}`}
                    </a>
                  )
                  : <span className="button button-secondary button-unavailable" aria-disabled="true">Checkout opening soon</span>}
            </article>
          )
        })}
      </div>
      <p className="pricing-note"><ShieldCheck weight="fill" /> *Google Apps Script and Slack quotas still apply. Checkout delivers a License Code, not a web account.</p>
    </div>
  )
}

export function PricingSection() {
  return (
    <section className="content-section pricing-section" aria-labelledby="pricing-title">
      <PricingTable />
    </section>
  )
}
