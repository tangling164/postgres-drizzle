import type { Metadata } from 'next'
import { BlogPostList } from '@/components/site/blog'
import { PageHero } from '@/components/site/content'
import { BreadcrumbJsonLd } from '@/components/site/seo'
import { blogPosts } from '@/lib/blog/posts'

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Practical guides on Google Forms, Slack notifications, and field-based filtering with FormAlert.',
  alternates: { canonical: '/blog' },
}

export default function BlogPage() {
  return (
    <main className="page-container narrow-section">
      <BreadcrumbJsonLd items={[{ name: 'Home', path: '/' }, { name: 'Blog', path: '/blog' }]} />
      <PageHero
        eyebrow="Blog"
        title="Google Forms and Slack, without the noise."
        description="Short guides on filtered alerts, webhook setup, and keeping useful submissions visible in Slack."
        align="center"
      />
      <BlogPostList posts={blogPosts} />
    </main>
  )
}
