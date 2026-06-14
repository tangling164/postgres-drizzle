function publicCreemCheckoutUrl(value: string | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    const isCreem = url.hostname === 'creem.io' || url.hostname.endsWith('.creem.io')
    const isTest = url.hostname.startsWith('test.') || url.pathname.includes('/test/')
    return url.protocol === 'https:' && isCreem && !isTest
      ? value
      : null
  } catch {
    return null
  }
}

export const siteConfig = {
  name: 'FormAlert for Slack',
  shortName: 'FormAlert',
  description: 'Send Google Forms responses to Slack only when they match your field rules.',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://formalert.app',
  marketplaceUrl: process.env.NEXT_PUBLIC_MARKETPLACE_URL ?? '/installation-guide',
  checkout: {
    standardMonthly: publicCreemCheckoutUrl(process.env.NEXT_PUBLIC_CREEM_STANDARD_MONTHLY_URL),
    standardYearly: publicCreemCheckoutUrl(process.env.NEXT_PUBLIC_CREEM_STANDARD_YEARLY_URL),
  },
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'support@formalert.app',
}

export const primaryNav = [
  { href: '/installation-guide', label: 'Setup guide' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/blog', label: 'Blog' },
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
      { href: '/blog', label: 'Blog' },
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
