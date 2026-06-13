import type { ReactNode } from 'react'
import { PageHero } from './content'

export function PolicyLayout({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return (
    <main className="page-container narrow-section">
      <PageHero eyebrow={eyebrow} title={title} description={description} />
      <article className="policy-content">{children}</article>
    </main>
  )
}
