# FormAlert for Slack Apps Script MVP

This directory contains the Google Forms Editor Add-on MVP. It is intentionally separate from the Next.js website.

## Runtime Boundary

- Opens from the Google Forms editor add-on menu and reads questions from the current Form.
- Stores one alert per connected Form in user-scoped Apps Script `UserProperties`; the global Form index contains no Webhooks or templates.
- Keeps current-Form status and the latest 10 metadata-only debug logs in document properties.
- Evaluates filters and renders templates in Apps Script.
- Sends matching notifications directly from Apps Script to the configured Slack Incoming Webhook.
- Calls the FormAlert entitlement API only for Google-account identity, License Code activation, and plan refresh. Form responses, Slack Webhooks, templates, and rendered payloads never leave Apps Script.

## Files

```text
Code.gs                  Forms Editor sidebar entry points and client-facing APIs
ConfigService.gs         Document and user property helpers
NotificationService.gs   Connected Form CRUD, search, pagination, migration, and validation
FieldService.gs          Current Form questions, latest response, and response maps
RuleEngine.gs            Number and text filter evaluation
MessageRenderer.gs       {{Question title}} extraction and rendering
PayloadService.gs        Block Kit JSON validation and safe rendering
SlackService.gs          Direct Incoming Webhook delivery
DebugService.gs          Redacted last status and latest 10 local logs
TriggerService.gs        Idempotent Form submit trigger setup
LicenseService.gs        Cached entitlement state and local feature enforcement
BackendService.gs        OIDC-authenticated License activation and plan refresh API client
ExecutionService.gs      Filter, render, send, and status pipeline
Sidebar.html             Main, All Notifications, Create/Edit UI
appsscript.json          Least-privilege Forms manifest
tests/run-tests.js       Local core-logic verification
ACCEPTANCE.md            Requirement matrix and real-runtime checklist
```

## Install For Manual Testing

1. Create a standalone Apps Script project and add each `.gs` file plus `Sidebar.html`.
2. Replace the Apps Script manifest with `appsscript.json`.
3. Create an Editor Add-on test deployment and select a Google Form as the test document.
4. Execute the test deployment and open FormAlert from the Forms add-on button.
5. Approve the requested current-Form, external-request, trigger, email, and OpenID scopes.

The first saved Form alert automatically attempts to enable automatic alerts. When authorization or trigger setup fails, the Main view displays `Automatic alerts need setup` and `Fix setup`.

Google's Editor Add-on test deployments do not support installable triggers. Use the test deployment for Sidebar and Send Test verification, then use an internal or published add-on installation to verify the real Form submit trigger.

For MVP testing, use one Google account as the Form configuration and trigger owner. Apps Script installable triggers execute as their creator.

## License Activation

License Codes are purchased through Creem and delivered by email. Activation sends only the License Code and a short-lived Google identity token to the FormAlert entitlement API. The code is never stored in Apps Script properties.

## Local Verification

```bash
pnpm test:plugin
```

The local test suite covers entitlement API calls, cross-Form storage and pagination, one-Form-one-alert behavior, Form question discovery, stable item IDs, latest responses, operators, templates, plan limits, trigger lifecycle, execution statuses, migration, debug-log retention, and permission/server boundaries.

See `ACCEPTANCE.md` for the requirement-by-requirement evidence and the real Google/Slack runtime checklist.

## Sync To Apps Script

The repository root `.clasp.json` is connected to the standalone `FormAlert for Slack` Apps Script project. After changing plugin code:

```bash
pnpm test:plugin
clasp push
clasp version "Describe the release"
clasp open-script
```

The root `.claspignore` uploads only runtime `.gs`, `.html`, and `appsscript.json` files.

## Manual Google Runtime Verification

The following behaviors require a real Google Form, Apps Script authorization, and Slack Incoming Webhook:

1. Sidebar opens from the Google Forms editor add-on button.
2. Refresh Fields reads questions from the current Form.
3. Test with Latest Response sends matching Message and Payload notifications.
4. In an internal or published installation, a real Google Form submission invokes the installable `onFormSubmit` trigger.
5. Matching responses send to Slack and nonmatching responses update status to skipped.
6. Copy debug info writes only redacted local operational metadata to the clipboard.
