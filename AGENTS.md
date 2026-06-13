# FormAlert Web Guide

## Project Overview

This Next.js App Router project is the public website and documentation site for **FormAlert for Slack**.

The repository also contains the plugin MVP under `apps-script/`. Website and plugin responsibilities must remain separate.

FormAlert itself is a Google Forms Editor Add-on. Each connected Form has one alert configuration. The add-on reads questions and responses from the current Google Form, evaluates field-based filters in Google Apps Script, and sends matching notifications directly to a user-owned Slack Incoming Webhook.

The website is responsible for:

- SEO and product positioning
- Installation and usage documentation
- Pricing and Creem Checkout entry points
- License Code delivery instructions
- FAQ, Privacy, Terms, Refund, and Support pages

The website must not become a dashboard or a replacement for the add-on.

## 语言规范

与此项目相关的所有 AI 回复使用**中文**。代码、变量名、注释和 commit message 除外，保持英文。

## Frontend Structure

```text
app/
  page.tsx                         Landing page
  pricing/page.tsx                 Monthly/yearly pricing
  installation-guide/page.tsx     Screenshot-driven setup documentation
  faq/page.tsx                     FAQ and FAQ structured data
  privacy/page.tsx                 Privacy policy
  terms/page.tsx                   Terms of service
  refund/page.tsx                  Refund policy
  support/page.tsx                 Support instructions
  checkout/success/page.tsx        License Code delivery instructions
  guides/                          SEO content pages
  sitemap.ts                       Search-engine sitemap
  robots.ts                        Crawler rules

components/site/
  config.ts                        URLs, checkout links, and support configuration
  site-shell.tsx                   Header, footer, logo, and shared CTA links
  content.tsx                      Reusable marketing and documentation sections
  pricing.tsx                      Billing toggle and pricing cards
  faq.tsx                          FAQ content and accordion
  policy-layout.tsx                Shared legal-page layout
  seo.tsx                          JSON-LD helpers

styles/
  tokens.css                       Design tokens
  base.css                         Global reset and typography primitives
  components.css                   Shared Button primitives
  site.css                         Marketing, docs, pricing, and responsive layouts

apps-script/
  Code.gs                          Sidebar entry points and Apps Script APIs
  Sidebar.html                     Plugin Main, All Notifications, and Create/Edit UI
  *Service.gs                      Forms-first plugin services
  appsscript.json                  Least-privilege Apps Script manifest
  tests/run-tests.js               Local plugin core-logic tests
```

## Web And Add-on Boundary

Core add-on functionality must stay out of the website:

- Do not add a web dashboard, login, or user account area.
- Do not recreate Webhook configuration, rule editing, tests, logs, or License activation as interactive web tools.
- Explain add-on functionality using product screenshots, guides, and concise copy.
- Web CTAs should lead to the Marketplace/install URL, documentation, Creem Checkout, or Support.

Core plugin functionality belongs only under `apps-script/`:

- Store one complete alert configuration per connected Form in user-scoped Apps Script `UserProperties`, keyed by `formId`.
- Keep the global connected-Form index free of Webhooks, templates, responses, and rendered payloads.
- Use current-Form document properties only for current-Form status, debug logs, credits, trigger errors, and legacy rollback data.
- Process response rows locally and send directly to Slack Incoming Webhooks.
- Keep debug logs redacted and limited to the latest 10 entries.
- Do not add Drive, Gmail, AI, Slack OAuth, FormAlert server, or server-log dependencies.

The website must never receive or store:

- Google Form responses or response values
- Slack Webhook URLs
- Slack message or payload templates
- Response values such as customer names, emails, budgets, or messages

## Component Reuse Rules

Always reuse existing components before creating a new one.

1. Use `ButtonLink` for calls to action.
2. Use `PageHero`, `SectionHeading`, `FeatureList`, `WorkflowSteps`, and `PluginScreenshot` for marketing composition.
3. Use `GuideStep`, `Callout`, and `DocsNavigation` for documentation.
4. Use `PricingTable` for pricing summaries and the full Pricing page.
5. Use `FAQAccordion` and `PolicyLayout` rather than duplicating FAQ or legal-page markup.
6. Extend components through props and variants before creating similar components.
7. Keep environment-specific links in `components/site/config.ts`.

## SEO Rules

- Every indexable route needs unique metadata, description, and canonical path.
- Use real App Router routes. Do not use hash-based navigation.
- Add Breadcrumb JSON-LD to nested pages and FAQ JSON-LD to FAQ content.
- Keep checkout success pages excluded from indexing.
- SEO content must remain accurate to the add-on's current feature set.

## Design Rules

- Keep the interface quiet, clean, and content-led.
- Prefer screenshots and concise instructions over decorative marketing sections.
- Do not use nested cards or oversized decorative elements.
- Keep responsive behavior in `styles/site.css`.
- Use existing tokens and Phosphor icons.
- Keep all runtime plugin UI copy English-only. Chinese may appear in planning documents, not in `Sidebar.html`.
- Form-level lists must deduplicate by `formId`, never by `formTitle`, and never render one row per field, Filter, or legacy notification.
- Plugin actions use icon-plus-text controls with visible hover, focus-visible, and active states; do not load icons from a runtime CDN.
- Avoid persistent explanatory, privacy, or unlimited-quota copy in the compact plugin Dashboard unless it is actionable.
- Use `.agents/skills/design-taste-frontend/SKILL.md` as the visual review checklist for landing-page and content-site changes.
- Before redesign work, declare the page kind, audience, visual direction, and `DESIGN_VARIANCE / MOTION_INTENSITY / VISUAL_DENSITY` values.
- Prefer targeted evolution: improve typography, spacing, color calibration, and interaction states before replacing whole sections.
- Keep Hero content to one eyebrow, one focused headline, one short description, and at most two CTAs.
- Avoid repeated three-equal-column feature grids, excessive eyebrow labels, generic cards, decorative animation, and warm template-like palettes.
- Run the taste skill pre-flight checks for CTA contrast, button wrapping, shape consistency, mobile collapse, reduced motion, and page overflow.

## Docs Maintenance Rules

- Update large planning documents (e.g. `docs/FormAlert_Full_Backend_Spec.md`) with precise, located, chunked edits: find the exact section, replace only that fragment, and apply one logical change per edit.
- Never rewrite a large document in a single whole-file pass; full rewrites stall the task, blow up diffs, and risk silently dropping unrelated sections.
- When applying a review document, map each review item to a numbered spec section first, then edit section by section in severity order (P0 → P1 → P2).
- Archive external review files under `docs/` and reference the review filename in the spec's revision header so decisions stay traceable.

## Verification

Before handing off changes, run:

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm build
pnpm test:plugin
```

Visually verify Landing, Pricing, Installation Guide, FAQ, and Privacy at desktop and mobile widths.
