export interface BlogPost {
  slug: string
  title: string
  description: string
  publishedAt: string
  paragraphs: readonly string[]
}

export const blogPosts: readonly BlogPost[] = [
  {
    slug: 'reduce-google-forms-slack-noise',
    title: 'How to reduce Google Forms Slack notification noise',
    description: 'Send only the form responses your team needs to act on, instead of every submission.',
    publishedAt: '2026-05-20',
    paragraphs: [
      'Most Google Forms to Slack setups notify the channel on every submission. That works when volume is low, but useful alerts disappear quickly as responses grow.',
      'A field filter adds one decision between the form and Slack. You choose a question, a condition, and a value. FormAlert evaluates each new response locally in Google Apps Script and sends a Slack message only when the rule matches.',
      'Common examples include budget thresholds on lead forms, priority labels on support requests, and severity flags on bug reports. The team sees fewer messages, but the ones that arrive are more likely to need action.',
      'FormAlert runs inside the Google Forms editor add-on. Webhook URLs and response values stay in your Google account. Matching notifications go directly to your Slack Incoming Webhook.',
    ],
  },
  {
    slug: 'google-forms-slack-webhook-setup',
    title: 'Google Forms to Slack: a focused webhook setup',
    description: 'Install FormAlert, paste a Slack Incoming Webhook, and send your first filtered alert in minutes.',
    publishedAt: '2026-06-01',
    paragraphs: [
      'You do not need a separate dashboard to connect Google Forms and Slack. Open the Form you want to monitor, install FormAlert from the Add-ons menu, and launch the sidebar inside the editor.',
      'Create a Slack Incoming Webhook for the channel that should receive alerts. Paste the URL into FormAlert, write a short message, and insert question variables such as {{Name}} or {{Budget}}.',
      'On the Free plan, every submission can go to Slack. On Standard, add a filter rule so only matching responses are sent. Test with the latest response before enabling automatic delivery.',
      'For step-by-step screenshots and troubleshooting, use the Installation Guide.',
    ],
  },
]

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((post) => post.slug === slug)
}

export function formatBlogDate(isoDate: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(isoDate))
}
