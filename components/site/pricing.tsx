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
}

const plans: readonly PricingPlan[] = [
  {
    name: 'Free',
    monthly: '$0',
    yearly: '$0',
    payment: 'No payment required',
    description: 'Try the complete local workflow in your current Google Form.',
    features: ['7-day trial', '30 Slack sends', '1 connected Google Form', 'Message Mode', 'Latest 10 redacted debug entries'],
  },
  {
    name: 'Standard',
    monthly: '$5',
    yearly: '$3.25',
    payment: '$39 billed yearly',
    description: 'For small teams filtering several Google Forms.',
    features: ['Unlimited Slack sends', 'Up to 20 connected Google Forms', 'Message & Payload Mode', 'Unlimited conditions per Form*', 'Latest 10 redacted debug entries'],
    featured: true,
  },
  {
    name: 'Business',
    monthly: '$8',
    yearly: '$6.50',
    payment: '$79 billed yearly',
    description: 'For teams running FormAlert across many workflows.',
    features: ['Unlimited Slack sends', 'Up to 100 connected Google Forms', 'Message & Payload Mode', 'Unlimited conditions per Form*', 'Latest 10 redacted debug entries', 'Priority support'],
  },
] as const

function checkoutUrl(name: string, cycle: BillingCycle) {
  if (name === 'Standard') return cycle === 'monthly' ? siteConfig.checkout.standardMonthly : siteConfig.checkout.standardYearly
  if (name === 'Business') return cycle === 'monthly' ? siteConfig.checkout.businessMonthly : siteConfig.checkout.businessYearly
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
        {plans.map((plan) => (
          <article className={`pricing-card ${plan.featured ? 'featured' : ''}`} key={plan.name}>
            {plan.featured && <span className="popular">Most popular</span>}
            <h3>{plan.name}</h3>
            <p>{plan.description}</p>
            <div className="plan-price"><strong>{cycle === 'monthly' ? plan.monthly : plan.yearly}</strong><span>/ month</span></div>
            <small>{cycle === 'yearly' ? plan.payment : plan.name === 'Free' ? plan.payment : 'Billed monthly'}</small>
            <ul>{plan.features.map((feature) => <li key={feature}><Check weight="bold" />{feature}</li>)}</ul>
            <a className={`button ${plan.featured ? 'button-primary' : 'button-secondary'}`} href={checkoutUrl(plan.name, cycle)}>
              {plan.name === 'Free' ? 'Get FormAlert App' : `Choose ${plan.name}`}
            </a>
          </article>
        ))}
      </div>
      <p className="pricing-note"><ShieldCheck weight="fill" /> *A safety limit of 50 conditions per Form applies. Checkout delivers a License Code, not a web account.</p>
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
