import './globals.css'
import { DM_Sans, Manrope } from 'next/font/google'
import type { Metadata } from 'next'
import { MarketingFooter, MarketingHeader } from '@/components/site/site-shell'
import { siteConfig } from '@/components/site/config'

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: 'FormAlert for Slack | Filtered Google Forms notifications',
    template: '%s | FormAlert for Slack',
  },
  description: siteConfig.description,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: siteConfig.name,
    title: 'FormAlert for Slack',
    description: siteConfig.description,
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FormAlert for Slack',
    description: siteConfig.description,
  },
}

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  display: 'swap',
})

const manrope = Manrope({
  variable: '--font-manrope',
  subsets: ['latin'],
  display: 'swap',
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} ${manrope.variable}`}>
        <MarketingHeader />
        {children}
        <MarketingFooter />
      </body>
    </html>
  )
}
