# FormAlert for Slack Plugin PRD v1.6

Version: v1.6  
Entry point: Google Forms Editor Add-on  
Product model: One Google Form has one FormAlert configuration.

## 1. Product Model

- A connected Google Form owns one Slack Alert configuration.
- One configuration may reference multiple Form questions and contain multiple Filter conditions.
- Configurations are scoped to the Google Account that created them and are not shared with Form collaborators.
- The Dashboard lists connected Forms exactly once by `formId`, even when two Forms have the same title.
- Search matches `formTitle` only.

Plan limits count all connected Forms, including paused Forms:

| Plan | Connected Forms | Filter conditions per Form | Slack sends |
|---|---:|---:|---:|
| Free | 1 | 1 | 30 |
| Standard | 10 | 5 | Unlimited |
| Business | 20 | 10 | Unlimited |

Delete releases a connected Form slot. Pause does not release a slot.

## 2. Runtime And Privacy Architecture

- Store each complete Form configuration in user-scoped Apps Script `UserProperties`, sharded by `formId`.
- Maintain a separate user-scoped Form index containing only `formId`, `formTitle`, notification ID, enabled state, and update time.
- Keep each serialized property below the Apps Script 9 KB per-property limit.
- Keep legacy `DocumentProperties` notification arrays for rollback. On first open, migrate only the most recently updated legacy alert for the current Form and show a warning when multiple legacy alerts existed.
- Install one idempotent Form submit trigger per connected Form. Saving creates or repairs the current Form trigger; Delete removes the matching Form trigger.
- Form responses, Slack Webhooks, templates, and rendered payloads never go to a FormAlert server.
- Do not add Drive, Gmail, AI, Slack OAuth, or non-Slack server dependencies.

## 3. Connected Forms Dashboard

- The Dashboard heading is `Connected Forms`.
- Home displays at most 3 Forms. `All Connected Forms` displays 10 Forms per page.
- Each row displays only the Google Form title and icon-plus-text actions:
  - Edit
  - Delete
  - Pause or Resume
- Do not display filter summaries, enabled badges, send times, message previews, or full logs.
- Edit on the current Form opens the local editor. Edit on another Form opens that Google Form editor in a new tab.
- Show `N / limit Forms`. Do not show `Unlimited alerts`.
- Remove the persistent Sidebar privacy paragraph.
- Upgrade, Edit, Delete, Pause, Resume, Refresh Fields, and Get Payload use icons plus hover, focus-visible, active, and reduced-motion-safe states.
- Hover raises actionable buttons slightly and adds a visible shadow; destructive Delete retains a red hover treatment.

## 4. Create And Edit

Do not display Form title, Notification Name, or Notification Status.

Editor order:

1. Slack Webhook URL
2. Add Form Field and Refresh Fields
3. Form question selector
4. Message, Payload, and conditional Get Payload controls on one row
5. Message or Payload template editor
6. Filters summary and independent Filters page
7. Send Test, Test latest response, and Save

Message and Payload retain separate template values when switching tabs. `Get Payload` appears only in Payload Mode and opens:

`https://app.slack.com/block-kit-builder/T0B9SHVRGG0/templates`

Selecting a Form question automatically inserts `{{Question title}}` at the active editor cursor. When no cursor exists, insert at the end of the currently selected editor.

## 5. Filters And Testing

- Filter is optional. No Filter means every new response is sent.
- A Condition contains Field, Operator, and Value. It has no status toggle.
- One Condition hides Match. Multiple Conditions show `Match: all / any`.
- Numeric operators: `=`, `!=`, `>`, `<`, `>=`, `<=`; internal values `eq`, `neq`, `gt`, `lt`, `gte`, `lte`.
- Text operators: `contains`, `equals`; internal values `contains`, `text_eq`.
- Strip `$`, commas, and spaces before numeric comparison. Invalid numbers produce an error flash.
- Send Test skips Filters. Static templates do not require an existing Form response.
- Test latest response loads the current Form's latest response and evaluates Filters.
- Tests do not consume Free credits.

## 6. Status, Debug, And Language

- Pause makes real Form submissions skip Slack delivery. Resume restores delivery.
- Users do not need to understand trigger implementation. Setup failures show a flash and `Fix setup`.
- All runtime plugin UI copy is English.
- Help contains `View plugin error logs`.
- The Debug panel shows Last status, Last run, Last error, the latest 10 redacted local debug entries, and Copy debug info.
- Debug data must not contain response values, Slack Webhooks, full templates, rendered payloads, or user emails.

## 7. Acceptance Criteria

- [ ] Google Forms remains the only plugin entry point.
- [ ] The same Google Account can see connected Forms from any Form.
- [ ] One `formId` produces one Dashboard row and one configuration.
- [ ] Forms with identical titles remain separate.
- [ ] Home shows 3 Forms; All Connected Forms shows 10 per page and searches only titles.
- [ ] Free, Standard, and Business enforce 1, 10, and 20 connected Forms.
- [ ] Paused Forms count toward the plan; Delete releases a slot and removes its trigger.
- [ ] Every connected Form has at most one submit trigger.
- [ ] Dashboard rows contain only title and icon actions.
- [ ] Message, Payload, and conditional Get Payload share one row.
- [ ] The Message/Payload/Get Payload row sits immediately above the active MessageTemplate or PayloadTemplate editor.
- [ ] Edit, Delete, Pause/Resume, and Upgrade have icons and visible hover feedback.
- [ ] Field selection inserts into the active template cursor.
- [ ] Send Test, Test latest response, Payload validation, Filters, Pause/Resume, and Debug continue working.
- [ ] Runtime UI contains no Chinese copy, `Unlimited alerts`, or persistent privacy paragraph.
- [ ] No Drive or Gmail permission is added.
