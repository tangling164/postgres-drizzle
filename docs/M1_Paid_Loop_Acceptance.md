# M1 Paid Loop Automated Acceptance

This acceptance flow proves that a real Creem Test-mode purchase produces an
email-only formal License Code that activates the matching paid plan through a
real Apps Script Google OIDC identity.

## What Is Automated

- Production configuration and retired Test-code preflight
- Creem-created order and license lookup
- Resend message-ID and recipient-mail-server delivery verification
- Formal License Code format and production hash verification
- Pending-to-active transition after real Apps Script OIDC activation
- Paid feature-contract assertions
- Database license, account, expiry, and single-active-license assertions
- SKU-specific monthly/yearly paid-period assertions
- Same-tier replacement and Standard-to-Business upgrade assertions

The License Code is never printed or written to disk. Verification normally
uses the exact license ID captured before activation. Supplying the plaintext
code is optional and adds an extra code-to-production-hash assertion.

## Run

```powershell
pnpm test:m1 -- preflight
```

Each SKU uses a separate snapshot and evidence report. Complete the checkout
using the matching URL printed by preflight. After the email arrives:

```powershell
pnpm test:m1 -- observe --plan standard --cycle yearly --email buyer@example.com
```

Paste the same code into FormAlert and activate it. Activate it a second time
to manually confirm same-account idempotency, then run:

```powershell
pnpm test:m1 -- verify --plan standard --cycle yearly --email buyer@example.com --expect-superseded standard
```

Continue with Business Monthly:

```powershell
pnpm test:m1 -- observe --plan business --cycle monthly --email buyer@example.com
```

Activate the Business code inside FormAlert, then run:

```powershell
pnpm test:m1 -- verify --plan business --cycle monthly --email buyer@example.com --expect-superseded standard
```

Finish with Business Yearly:

```powershell
pnpm test:m1 -- observe --plan business --cycle yearly --email buyer@example.com
pnpm test:m1 -- verify --plan business --cycle yearly --email buyer@example.com --expect-superseded business
```

The intended sequence is Standard Yearly, Business Monthly, then Business
Yearly. Every activation must leave exactly one active license. Standard
Yearly replaces Standard Monthly, Business Monthly upgrades Standard to
Business, and Business Yearly replaces Business Monthly.

After all four SKUs have been activated in sequence, generate the final
database-backed evidence report:

```powershell
pnpm test:m1 -- summary --email buyer@example.com
```

## Human Steps

Human assistance remains necessary for completing Creem checkout, reading the
one-time plaintext License Code, and clicking Activate inside the real add-on.
This preserves the production Google OIDC trust boundary instead of adding test
credentials or a bypass. A second Google account is required only for the
optional cross-account rejection check.
