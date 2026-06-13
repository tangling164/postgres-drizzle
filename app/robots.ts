import type { MetadataRoute } from 'next'
import { siteConfig } from '@/components/site/config'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/checkout/success'] },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  }
}
