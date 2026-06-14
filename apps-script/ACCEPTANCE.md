# FormAlert Plugin MVP Acceptance

This document separates locally verified behavior from checks that require a real Google Form and Slack Incoming Webhook.

## Automated And Source-Verified Requirements

| Requirement | Evidence | Status |
|---|---|---|
| Google Forms Editor entry | `FormApp.getUi().createAddonMenu()` and `showSidebar()` in `Code.gs` | Source verified |
| Current Form question fields | `FieldService.getFields()` reads `FormApp.getActiveForm().getItems()` | Verified |
| Stable internal field IDs | Saved conditions use `fieldId`, `fieldTitle`, and `fieldType` | Verified |
| Refresh Fields | Sidebar calls `refreshFields()` and shows current Form questions | Verified |
| Connected Forms dashboard | User-scoped Form index deduplicates by `formId`, searches titles, and paginates 10 per page | Verified |
| One Form, one alert | Save updates the current Form configuration instead of creating duplicates | Verified |
| Webhook stored locally | Complete Form configuration uses user-scoped Apps Script `UserProperties`; summary index contains no Webhook or template | Source verified |
| Six numeric operators | `eq`, `neq`, `gt`, `lt`, `gte`, `lte` tests | Verified |
| Text operators | `contains` and `text_eq` tests | Verified |
| Match all / any | RuleEngine tests; Match UI appears only for multiple conditions | Verified |
| Message Mode | `MessageRenderer` resolves readable question-title variables from item-ID response maps | Verified |
| Payload Mode | JSON structure validation, recursive rendering, and special-character tests | Verified |
| Test with latest response | `form.getResponses()` and execution tests | Locally verified; real Slack send requires manual check |
| First save enables alerts | `NotificationService.save()` calls idempotent Form trigger setup | Verified |
| Trigger setup recovery | `needs_setup`, Fix setup, Form source ID detection, duplicate cleanup, and redacted failure logging tests | Verified |
| Form submit pipeline | Simulated Forms `e.response` event covers `onFormSubmit()` execution | Locally verified; real Google event requires manual check |
| Last status and Copy debug info | Latest 10 logs use a strict metadata whitelist; no response, Webhook, payload, email, or notification name | Verified |
| License activation and limits | OIDC-authenticated official License Code activation; Free has no Filter Rules and 1 connected Form; Standard has 20 connected Forms and up to 50 conditions per Form | Verified |
| Account-level Free quota | Real sends reserve the one-time 7-day / 30-send account quota through the entitlement API; Tests are rate limited and stop after trial expiry | Verified |
| Deterministic downgrade | Oldest connected Forms remain entitled; other Forms and unsupported paid features show `Paused by plan limit` without deleting settings | Verified |
| No prohibited integrations | Manifest/source tests reject Sheets, Drive, Gmail, AI, and endpoints other than Slack plus the FormAlert entitlement API | Verified |

Run the automated checks with:

```bash
pnpm test:plugin
```

## Real Google And Slack Runtime Acceptance

These checks cannot be proven by the local Node test harness. Use a Google Forms Editor Add-on test deployment for Sidebar and Send Test checks. Google's test deployments do not support installable triggers, so verify trigger checks with an internal or published add-on installation.

Create a Form with these questions:

```text
Name | Email | Budget | Message | Priority
```

Submit at least these responses:

```text
Budget = 150, Message = Need a refund, Priority = High
Budget = 100, Message = General question, Priority = Low
```

### Manual Checklist

- [ ] Reload the Form editor and open FormAlert from the top-right add-on button.
- [ ] Confirm the Sidebar shows the current Google account, plan, connected Form count, and no full log list.
- [ ] Activate an official emailed Standard License Code and confirm the Sidebar shows the matching full label, such as `Standard / Monthly` or `Standard / Yearly`.
- [ ] Re-enter the same License Code on the same account and confirm activation remains successful without creating another active license.
- [ ] Try the activated License Code on another Google account and confirm the add-on reports that the code is already used.
- [ ] On Free, confirm Filter Rules cannot be created, saved, or tested, and real sends across different Forms share one account-level 30-send quota.
- [ ] After Free trial expiry or exhaustion, confirm both real sends and Test sends are rejected.
- [ ] Open another configured Form and confirm the same account-level Connected Forms list appears.
- [ ] Click Refresh Fields and confirm all current Form questions appear.
- [ ] Insert `{{Budget}}` into Message Mode at the current cursor position.
- [ ] In an internal or published installation, save a rule for `Budget > 100`; confirm `Automatic alerts: Enabled`.
- [ ] Test with the latest matching Form response and confirm Slack receives the message.
- [ ] Test with `Budget <= 100` and confirm the result is `skipped` with no Slack message.
- [ ] Paste a valid Block Kit payload, validate it, and confirm a matching test reaches Slack.
- [ ] Enter invalid Payload JSON and confirm save/test shows a validation error.
- [ ] Submit the real Google Form with `Budget > 100`; confirm `onFormSubmit` sends Slack.
- [ ] Submit the real Google Form with `Budget <= 100`; confirm Slack receives nothing and last status is `skipped`.
- [ ] Remove trigger authorization or force setup failure; confirm `Automatic alerts need setup` and `Fix setup`.
- [ ] Copy debug info and confirm it contains no Webhook URL, Form response values, email, full message, or full payload.
- [ ] Confirm the same Google account that configured the notification owns the installable trigger.
- [ ] Downgrade from Standard and confirm out-of-plan Forms or paid features show `Paused by plan limit`; reactivate Standard and confirm the saved settings become eligible again.

## Privacy Boundary

- Form response values are read and processed only in Apps Script.
- Slack Webhooks and Form alert configurations remain in user-scoped Apps Script properties.
- The connected-Form summary index contains no Webhooks, templates, responses, or rendered payloads.
- Slack delivery goes directly from Apps Script to `hooks.slack.com`.
- Debug logs retain at most 10 redacted operational entries.
- The manifest requests no Sheets, Drive, Gmail, or all-Forms permission.
