import { CaretDown } from '@phosphor-icons/react/dist/ssr'

export const faqItems = [
  ['Does my payment email need to match my Google email?', 'No. Your payment email is used for receipts and License Code delivery. Activate the License Code inside the add-on from the Google account where you use FormAlert.'],
  ['How do I use my License Code?', 'After payment, copy the License Code from the success page or delivery email. Open FormAlert in your Google Form, open License, paste the code, and activate it.'],
  ['Can I move a License Code to another account?', 'During MVP, contact support with your License Code and payment email. We will manually reset the old installation binding.'],
  ['Do you store Google Form responses?', 'No. Response data is processed in your Google Apps Script environment and is not sent to FormAlert servers.'],
  ['Do you store my Slack Webhook URL?', 'No. The Webhook URL stays in user-scoped Apps Script PropertiesService for your connected Google Forms.'],
  ['Does FormAlert support Slack Block Kit payloads?', 'Yes. Paste JSON from Slack Block Kit Builder into Payload Mode, insert Form question variables, validate it, and test with the latest response.'],
  ['Which filter rules are supported?', 'The MVP supports equals, contains, and greater than. Rules run locally before a notification is sent to Slack.'],
  ['What are the Free plan limits?', 'Free includes a 7-day trial, up to 30 Slack sends, one connected Google Form, Message Mode, one filter condition, and the latest 10 redacted local debug entries.'],
  ['How do refunds work?', 'Paid plans include a 5-day easy refund policy. Contact support with your payment email and order details.'],
] as const

export function FAQAccordion({ limit }: { limit?: number }) {
  return (
    <div className="faq-list">
      {faqItems.slice(0, limit).map(([question, answer]) => (
        <details key={question}>
          <summary>{question}<CaretDown /></summary>
          <p>{answer}</p>
        </details>
      ))}
    </div>
  )
}
