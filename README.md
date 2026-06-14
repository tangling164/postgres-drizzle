# FormAlert for Slack Web

Public marketing, documentation, pricing, and policy site for the FormAlert Google Forms Editor Add-on.

## Development

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

## Configuration

Copy `.env.example` and configure:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_MARKETPLACE_URL`
- Two Creem Checkout URLs for Standard monthly/yearly plans
- `NEXT_PUBLIC_SUPPORT_EMAIL`

Production pricing only enables Standard checkout for HTTPS Creem URLs outside
Creem Test mode. Run `pnpm test:m15 -- verify-live-config` before opening sales.

## Product Boundary

The website explains, sells, and supports FormAlert. Webhook setup, field rules, message templates, tests, and local debug status run inside the Google Forms Editor Add-on.
