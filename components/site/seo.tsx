import { siteConfig } from './config'

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
}

export function SoftwareApplicationJsonLd() {
  return (
    <JsonLd data={{
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: siteConfig.name,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Google Forms, Google Apps Script',
      description: siteConfig.description,
      offers: [
        { '@type': 'Offer', price: '0', priceCurrency: 'USD', name: 'Free' },
        { '@type': 'Offer', price: '5', priceCurrency: 'USD', name: 'Standard monthly' },
        { '@type': 'Offer', price: '8', priceCurrency: 'USD', name: 'Business monthly' },
      ],
    }} />
  )
}

export function BreadcrumbJsonLd({ items }: { items: Array<{ name: string; path: string }> }) {
  return (
    <JsonLd data={{
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: `${siteConfig.url}${item.path}`,
      })),
    }} />
  )
}
