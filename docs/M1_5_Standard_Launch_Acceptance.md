# M1.5 Standard Launch Acceptance

Standard is the only paid plan approved for public sale in M1.5. Business stays
visible as `Coming soon` and has no public checkout action.

## Product Contract

- Free: one-time 7-day trial, 30 total Slack sends, 1 connected Form, Message
  Mode, no Filter Rules, no Payload Mode.
- Standard Monthly / Yearly: up to 20 connected Forms, Filter Rules, Message
  and Payload Mode, up to 50 conditions per Form, and no FormAlert send cap.
- Google Apps Script and Slack quotas still apply.

## Automated Gate

Run:

```bash
pnpm test:m15
pnpm lint
pnpm exec tsc --noEmit
pnpm test:backend
pnpm test:plugin
pnpm build
pnpm test:m15 -- verify-live-config
```

`test:m15` verifies the public promise, Free feature gates, account-level send
quota path, deterministic downgrade behavior, explicit plan-blocked UI, Webhook
event idempotency, expired-trial Test denial, and runtime certification support.
`verify-live-config` rejects missing Marketplace installation links, missing
production secrets, fake success-page checkout fallbacks, and Creem Test-mode
Standard Checkout URLs. It also verifies distinct Standard product IDs, the
Google OIDC audience, and that the transaction database URL is a direct
connection to the same production database.

After the approved production migration, run the read-only database gate:

```bash
pnpm test:production-readiness
```

It verifies every repository migration is applied, Business has no pending or
active licenses, old Test licenses remain retired, subscriptions are unique,
and active account caches match their authoritative licenses.

## Database Integration Gate

Use a dedicated Neon test branch URL, never the production database:

```bash
M15_TEST_DATABASE_URL="<dedicated-test-branch-url>" pnpm test:db-integration
```

The integration suite must prove account bootstrap, concurrent Free 30/31
boundaries, reservation release idempotency, concurrent Webhook claim and
retry ownership, out-of-order paid events, purchase, renewal, cancellation,
payment failure, refund/dispute, and downgrade cron state transitions.

## Release Order

1. Pass the dedicated Neon branch integration gate.
2. With explicit approval, retire every pending or active Business test
   license and remove Business Checkout/product environment variables.
3. Apply repository migrations before deploying code that depends on them.
4. Deploy the backend with Live Creem and Resend configuration.
5. Pass `verify-live-config` and `test:production-readiness`.
6. Push and version the Apps Script build.
7. Complete the runtime, Live Checkout, downgrade recovery, and 24-hour soak
   gates before enabling the public Standard Checkout buttons.

The Business retirement command defaults to a read-only dry run. Applying it
requires both `--apply` and the exact confirmation phrase:

```bash
pnpm m15:retire-business-test-licenses -- --buyer-email <buyer-email>
pnpm m15:retire-business-test-licenses -- --buyer-email <buyer-email> --apply --confirm RETIRE_BUSINESS_TEST_LICENSES
```

## Real Apps Script Gate

1. Deploy the M1.5 Apps Script build.
2. Activate a Standard license on the certification Google account.
3. Connect exactly 20 real Google Forms and confirm each has one trigger.
4. Submit matching and non-matching responses across the Forms.
5. Copy plugin debug info into a local JSON file.
6. Run:

```bash
pnpm test:m15 -- verify-runtime --snapshot <debug-info.json>
```

The snapshot must report a Standard entitlement synchronized within five
minutes of capture, 20 configured, enabled, and entitled Forms, 20 active
trigger Forms, and zero blocked, duplicate, or orphan trigger counts.

## Human-Assisted Final Checks

- Confirm Standard Monthly and Standard Yearly Live checkout each deliver one
  official License Code email.
- Confirm each code activates as the matching full plan specification.
- Confirm Free cannot create, save, or test Filter Rules.
- Confirm downgrade shows `Paused by plan limit` instead of silently dropping
  submissions, and upgrade restores eligibility without deleting settings.
- Complete a 24-hour Standard soak with no missing or duplicate Slack sends.

Record the final human-assisted results using
`docs/M1_5_Standard_Launch_Evidence.example.json`, then run:

```bash
pnpm test:m15 -- verify-launch-evidence --evidence <completed-evidence.json>
```

Standard is formally sellable only after every automated, database, runtime,
checkout, and soak gate above passes.
