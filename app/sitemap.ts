import type { MetadataRoute } from 'next'
import { siteConfig } from '@/components/site/config'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    '/',
    '/pricing',
    '/installation-guide',
    '/faq',
    '/privacy',
    '/terms',
    '/refund',
    '/support',
    '/guides/google-forms-to-slack',
  ].map((path) => ({ url: `${siteConfig.url}${path}`, lastModified: new Date(), changeFrequency: path === '/' ? 'weekly' : 'monthly', priority: path === '/' ? 1 : 0.7 }))
}
