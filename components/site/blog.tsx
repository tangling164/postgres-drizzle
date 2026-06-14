import Link from 'next/link'
import { formatBlogDate, type BlogPost } from '@/lib/blog/posts'

export function BlogPostList({ posts }: { posts: readonly BlogPost[] }) {
  return (
    <ul className="blog-list">
      {posts.map((post) => (
        <li key={post.slug}>
          <article className="blog-card">
            <time dateTime={post.publishedAt}>{formatBlogDate(post.publishedAt)}</time>
            <h2><Link href={`/blog/${post.slug}`}>{post.title}</Link></h2>
            <p>{post.description}</p>
            <Link className="blog-card-link" href={`/blog/${post.slug}`}>Read article</Link>
          </article>
        </li>
      ))}
    </ul>
  )
}
