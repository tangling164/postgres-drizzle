# Landing Page Redesign Spec v2

**Status:** Approved — 2026-06-14
**Replaces:** Ad-hoc inline discussion; this is the canonical reference for the v2 landing page.

---

## Design Read

B2B productivity tool landing page for Google Workspace power users.
Audience: Google Forms admins who send form responses to Slack.
Visual direction: clean, content-led, existing violet/cream palette retained.
Mode: Redesign — targeted evolution (preserve brand tokens, overhaul structure and copy).

**Dials:** `DESIGN_VARIANCE: 5` | `MOTION_INTENSITY: 2` | `VISUAL_DENSITY: 3`

---

## Section Map

```
NAV
SECTION 1 — HERO          centered layout, text + CTAs + video (no poster image)
SECTION 2 — WORKFLOW      Google Form → Field Filter → Slack notification
SECTION 3 — HOW IT WORKS  3 steps with per-step screenshots
SECTION 4 — PRICING       centered heading + pricing table
SECTION 5 — FINAL CTA     h2 + single button
FOOTER
```

PrivacyStrip lives between HOW IT WORKS and PRICING.

---

## Section 1 — HERO

### Layout

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│     Only notify Slack when a response matches.           │
│              ← H1, centered, single line →               │
│                                                          │
│          Field-filtered alerts for Google Forms.         │
│              ← subtext, centered, 6 words →              │
│                                                          │
│       [ Get FormAlert Free ]   [ See how it works ]      │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │              VIDEO (no poster image)               │  │
│  │              src: /product/demo.mp4                │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

No `poster` attribute on `<video>`. Use `aspect-ratio: 16/9` container until the file is supplied.

---

## Section 2 — WORKFLOW

Replaces the old "Set up in under 5 minutes" copy. Centered heading + horizontal flow diagram.

```
┌──────────────────────────────────────────────────────────┐
│              One focused workflow                        │
│           Filter before you notify.                      │
│   FormAlert adds one useful decision between a Google    │
│   Forms submission and a Slack notification.             │
│                                                          │
│   Google Form  →  Field Filter  →  Slack notification    │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

Uses existing `.workflow-section` + `.simple-flow` components.

---

## Section 3 — HOW IT WORKS

Three steps alternating left/right with per-step screenshots (unchanged from v2 approval).

### Copy

| Element | Content |
|---|---|
| H1 | Only notify Slack when a response matches. |
| Subtext | Field-filtered alerts for Google Forms. |
| Primary CTA | Get FormAlert Free |
| Secondary CTA | See how it works (anchor: `#how-it-works`) |

### CSS Classes

- `.landing-hero-v2` — flex column, centered, `padding: 80px 28px 72px`
- `.hero-actions-centered` — `justify-content: center` modifier on `.hero-actions`

---

## Section 2 — HOW IT WORKS

### Layout

Single flow image showing the full setup process (install → webhook → optional rule).

```
┌──────────────────────────────────────────────────────────┐
│              It works in 3 simple steps                  │
│   Install FormAlert, connect Slack, and optionally       │
│              add a filter rule.                          │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │         [ setup-flow.png — full width ]            │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│              [ Read installation guide ]                 │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Copy

| Element | Content |
|---|---|
| H2 | It works in 3 simple steps |
| Lead | Install FormAlert, connect Slack, and optionally add a filter rule. |
| CTA | Read installation guide → `/installation-guide` |

### Asset

| Path | Status |
|---|---|
| `/public/product/setup-flow.png` | TODO — single diagram showing install, webhook, and filter steps |

Until the asset is ready, `app/page.tsx` uses `/product/rule-editor.png` as interim src.

---

## Section 3 — PRICING

### Heading (centered, shared on landing + `/pricing`)

| Element | Content |
|---|---|
| H2 | Simple, Transparent & Fixed Pricing |
| Body | Start with 30 Slack notifications for free and upgrade to Standard once you are happy. |

The dedicated `/pricing` page does **not** repeat a PageHero above the table. Breadcrumb only, then `PricingSection`.

---

## Section 4 — FINAL CTA

```
┌──────────────────────────────────────────────────────────┐
│  Send the responses your team needs to act on.           │
│                              [ Get FormAlert Free ]      │
└──────────────────────────────────────────────────────────┘
```

Reuses existing `.final-cta` layout (flex row, text left, button right).
`<p>` removed — only h2 + button.

---

## Deleted Sections (vs v1 landing page)

| Removed section | Reason |
|---|---|
| Hero video with poster image | Oversized placeholder hurt layout review; add video only when `/product/demo.mp4` exists |
| Per-step How It Works layout | Replaced by single setup-flow image |
| `workflow-section` (simple-flow diagram) | Redundant with Hero H1 |
| `FeatureList capabilities` | Removed in v2 |
| `product-proof` | Removed in v2 |
| `FeatureList use-cases` | Removed in v2 |
| `setup-preview WorkflowSteps` | Replaced by setup-flow image |
| Pricing page `PageHero` | Duplicate of centered pricing table heading |

---

## Asset TODOs

1. **`/public/product/setup-flow.png`** — one wide diagram: install add-on → paste Webhook + message → optional filter rule.
2. **`/public/product/demo.mp4`** — optional hero walkthrough video (do not use a poster image placeholder).
