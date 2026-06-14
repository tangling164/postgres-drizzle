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

The License Code is never printed or written to disk.

## Run

```powershell
pnpm test:m1 -- preflight
```

Complete the Standard Test checkout using the URL printed by preflight. After
the email arrives:

```powershell
pnpm test:m1 -- observe --plan standard --email buyer@example.com
```

Paste the same code into FormAlert and activate it. Activate it a second time
to manually confirm same-account idempotency, then run:

```powershell
$env:M1_LICENSE_CODE = "<same code from email>"
pnpm test:m1 -- verify --plan standard --email buyer@example.com
Remove-Item Env:M1_LICENSE_CODE
```

Repeat with the Business Test checkout:

```powershell
pnpm test:m1 -- observe --plan business --email buyer@example.com
```

Activate the Business code inside FormAlert, then run:

```powershell
$env:M1_LICENSE_CODE = "<same code from email>"
pnpm test:m1 -- verify --plan business --email buyer@example.com --expect-upgrade
Remove-Item Env:M1_LICENSE_CODE
```

Standard should activate with 20 connected Forms. Business should upgrade the
same account to 100 connected Forms and supersede its previous active license.

## Human Steps

Human assistance remains necessary for completing Creem checkout, reading the
one-time plaintext License Code, and clicking Activate inside the real add-on.
This preserves the production Google OIDC trust boundary instead of adding test
credentials or a bypass. A second Google account is required only for the
optional cross-account rejection check.
