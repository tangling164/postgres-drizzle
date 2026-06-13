export const siteConfig = {
  name: 'FormAlert for Slack',
  shortName: 'FormAlert',
  description: 'Send Google Forms responses to Slack only when they match your field rules.',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://formalert.app',
  marketplaceUrl: process.env.NEXT_PUBLIC_MARKETPLACE_URL ?? '/installation-guide',
  checkout: {
    standardMonthly: process.env.NEXT_PUBLIC_CREEM_STANDARD_MONTHLY_URL ?? '/checkout/success?plan=standard&cycle=monthly',
    standardYearly: process.env.NEXT_PUBLIC_CREEM_STANDARD_YEARLY_URL ?? '/checkout/success?plan=standard&cycle=yearly',
    businessMonthly: process.env.NEXT_PUBLIC_CREEM_BUSINESS_MONTHLY_URL ?? '/checkout/success?plan=business&cycle=monthly',
    businessYearly: process.env.NEXT_PUBLIC_CREEM_BUSINESS_YEARLY_URL ?? '/checkout/success?plan=business&cycle=yearly',
  },
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'support@formalert.app',
}

export const primaryNav = [
  { href: '/installation-guide', label: 'Setup guide' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/faq', label: 'FAQ' },
]

export const footerGroups = [
  {
    title: 'Product',
    links: [
      { href: '/pricing', label: 'Pricing' },
      { href: '/installation-guide', label: 'Installation guide' },
      { href: '/checkout/success', label: 'License delivery' },
    ],
  },
  {
    title: 'Help',
    links: [
      { href: '/faq', label: 'FAQ' },
      { href: '/support', label: 'Support' },
      { href: '/guides/google-forms-to-slack', label: 'Google Forms to Slack guide' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy' },
      { href: '/terms', label: 'Terms' },
      { href: '/refund', label: 'Refund policy' },
    ],
  },
]
