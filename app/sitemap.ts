import type { MetadataRoute } from 'next'
import { siteConfig } from '@/components/site/config'
import { blogPosts } from '@/lib/blog/posts'

const staticPaths = [
  '/',
  '/pricing',
  '/installation-guide',
  '/blog',
  '/faq',
  '/privacy',
  '/terms',
  '/refund',
  '/support',
  '/guides/google-forms-to-slack',
]

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...staticPaths.map((path) => ({
      url: `${siteConfig.url}${path}`,
      lastModified: new Date(),
      changeFrequency: path === '/' ? 'weekly' as const : 'monthly' as const,
      priority: path === '/' ? 1 : 0.7,
    })),
    ...blogPosts.map((post) => ({
      url: `${siteConfig.url}/blog/${post.slug}`,
      lastModified: new Date(post.publishedAt),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ]
}
