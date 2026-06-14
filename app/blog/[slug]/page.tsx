import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DocsNavigation } from '@/components/site/content'
import { BreadcrumbJsonLd } from '@/components/site/seo'
import { blogPosts, formatBlogDate, getBlogPost } from '@/lib/blog/posts'

export function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const post = getBlogPost(slug)
  if (!post) return {}
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
  }
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = getBlogPost(slug)
  if (!post) notFound()

  const postIndex = blogPosts.findIndex((item) => item.slug === slug)
  const previous = postIndex > 0 ? blogPosts[postIndex - 1] : undefined
  const next = postIndex < blogPosts.length - 1 ? blogPosts[postIndex + 1] : undefined

  return (
    <main className="page-container narrow-section">
      <BreadcrumbJsonLd items={[
        { name: 'Home', path: '/' },
        { name: 'Blog', path: '/blog' },
        { name: post.title, path: `/blog/${post.slug}` },
      ]} />
      <article className="blog-article">
        <header className="blog-article-header">
          <time dateTime={post.publishedAt}>{formatBlogDate(post.publishedAt)}</time>
          <h1>{post.title}</h1>
          <p>{post.description}</p>
        </header>
        <div className="article-content blog-article-content">
          {post.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          {post.slug === 'google-forms-slack-webhook-setup' && (
            <p><Link href="/installation-guide">Open the Installation Guide</Link> for screenshots and troubleshooting.</p>
          )}
        </div>
      </article>
      <DocsNavigation
        previous={previous ? { href: `/blog/${previous.slug}`, label: previous.title } : undefined}
        next={next ? { href: `/blog/${next.slug}`, label: next.title } : undefined}
      />
    </main>
  )
}
