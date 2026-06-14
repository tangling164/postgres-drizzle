import { CaretDown } from '@phosphor-icons/react/dist/ssr'

export const faqItems = [
  ['Does my payment email need to match my Google email?', 'No. Your payment email is used for receipts and License Code delivery. Activate the License Code inside the add-on from the Google account where you use FormAlert.'],
  ['How do I use my License Code?', 'After payment, copy the License Code from the delivery email. Open FormAlert in your Google Form, paste the code in Plan & License, and activate it.'],
  ['Can I move a License Code to another account?', 'Contact support with your payment email and order details. We can revoke the old License Code and issue a replacement after verifying the purchase.'],
  ['Do you store Google Form responses?', 'No. Response data is processed in your Google Apps Script environment and is not sent to FormAlert servers.'],
  ['Do you store my Slack Webhook URL?', 'No. The Webhook URL stays in user-scoped Apps Script PropertiesService for your connected Google Forms.'],
  ['Does FormAlert support Slack Block Kit payloads?', 'Yes. Paste JSON from Slack Block Kit Builder into Payload Mode, insert Form question variables, validate it, and test with the latest response.'],
  ['Which filter rules are supported?', 'The MVP supports equals, contains, and greater than. Rules run locally before a notification is sent to Slack.'],
  ['What are the Free plan limits?', 'Free includes a 7-day trial, up to 30 Slack sends, one connected Google Form, Message Mode, one filter condition, and the latest 10 redacted local debug entries.'],
  ['How do refunds work?', 'Payments are non-refundable. You can cancel at any time and keep paid access until the end of the current billing period. Contact support for payment disputes or billing errors.'],
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
