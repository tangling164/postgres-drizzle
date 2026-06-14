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
SECTION 1 — HERO          centered layout, video below CTAs
SECTION 2 — HOW IT WORKS  3 steps with per-step screenshots
SECTION 3 — PRICING       existing PricingSection (unchanged)
SECTION 4 — FINAL CTA     h2 + single button
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
│  │                                                    │  │
│  │                  VIDEO PLAYER                      │  │
│  │    poster: /product/rule-editor.png                │  │
│  │    src:    /product/demo.mp4  (to be supplied)     │  │
│  │                                                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Copy

| Element | Content |
|---|---|
| H1 | Only notify Slack when a response matches. |
| Subtext | Field-filtered alerts for Google Forms. |
| Primary CTA | Get FormAlert Free |
| Secondary CTA | See how it works (anchor: `#how-it-works`) |

### CSS Classes

- `.landing-hero-v2` — flex column, centered, `min-height: calc(100dvh - 68px)`, `padding-top: 80px`
- `.hero-actions-centered` — `justify-content: center` modifier on `.hero-actions`
- `.hero-video-wrap` — `max-width: 860px`, `border-radius: 8px`, `box-shadow: var(--shadow-window)`
- `.hero-video` — `width: 100%`, `height: auto`, `display: block`

### Video Spec

- Element: native `<video>` with `controls` and `preload="none"`
- Poster: `/product/rule-editor.png` (temporary until demo video is supplied)
- Source: `/product/demo.mp4`
- Content: 30-60 second walkthrough — open Google Form → install add-on → paste webhook + message → set filter rule → receive Slack notification

---

## Section 2 — HOW IT WORKS

### Layout

Three steps alternating left/right. Copy is always first in DOM order; CSS `order` handles the visual flip.

```
┌──────────────────────────────────────────────────────────┐
│  Set up in under 5 minutes                               │
│                                                          │
│  ─────────────────────────────────────────────────────   │
│  STEP 1                                                  │
│  ┌────────────────────┐   ┌──────────────────────────┐  │
│  │ copy               │   │ screenshot               │  │
│  │ ① Install FormAlert│   │ (add-on install menu)    │  │
│  └────────────────────┘   └──────────────────────────┘  │
│                                                          │
│  ─────────────────────────────────────────────────────   │
│  STEP 2 (flipped)                                        │
│  ┌──────────────────────────┐   ┌────────────────────┐  │
│  │ screenshot               │   │ copy               │  │
│  │ (webhook config screen)  │   │ ② Add your Webhook │  │
│  └──────────────────────────┘   └────────────────────┘  │
│                                                          │
│  ─────────────────────────────────────────────────────   │
│  STEP 3                                                  │
│  ┌────────────────────┐   ┌──────────────────────────┐  │
│  │ copy               │   │ screenshot               │  │
│  │ ③ Set a filter rule│   │ (rule editor)            │  │
│  └────────────────────┘   └──────────────────────────┘  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Copy

| Step | Num label | H3 | Body |
|---|---|---|---|
| 1 | Step 1 | Install FormAlert | Open your Google Form, click Add-ons, and install FormAlert from the Marketplace. |
| 2 | Step 2 | Add your Webhook | Paste your Slack Webhook URL and write your message. Done. |
| 3 | Step 3 | Set a filter rule | Choose a field and a condition. FormAlert only notifies Slack when a response matches. Free plan works without this step. |

### Screenshots Required

| Step | Path | Status |
|---|---|---|
| 1 | `/product/addon-install.png` | TODO — needs new screenshot of Google Forms Add-ons install menu |
| 2 | `/product/delivery-logs.png` | TODO — temporary, replace with webhook config screen screenshot |
| 3 | `/product/rule-editor.png` | Ready |

### CSS Classes

- `.how-it-works` — `background: var(--cream)`, top/bottom borders
- `.how-it-works-inner` — content container, `max-width: var(--content-max)`, `padding: 80px 28px`
- `.how-it-works-heading` — h2, `font-size: clamp(28px, 3.5vw, 38px)`
- `.how-step` — 2-col grid, `gap: 64px`, top border + padding as separator
- `.how-step-copy` — text column
- `.how-step-num` — step label, `12px`, `font-weight: 800`, `color: var(--violet)`
- `.how-step-flipped` — applies `order: 1` to figure, `order: 2` to `.how-step-copy` at desktop
- Mobile (`< 768px`): all steps collapse to single column, copy always renders before screenshot

---

## Section 3 — PRICING

Unchanged. Reuses existing `<PricingSection />`.
`<PrivacyStrip />` renders immediately above this section.

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
| `workflow-section` (simple-flow diagram) | Redundant with Hero H1 |
| `FeatureList capabilities` (3 feature cards) | Merged concept into How It Works step 3 |
| `product-proof` (Core work stays in add-on) | Redundant with Hero video |
| `FeatureList use-cases` (Sales/Feedback/Bug) | Dilutes focus |
| `setup-preview WorkflowSteps` (4-step grid) | Replaced by Section 2 with screenshots |

---

## Screenshot TODOs

Two new screenshots are needed before the page is considered fully complete:

1. **`/public/product/addon-install.png`** — Google Forms editor with the Add-ons menu open, showing FormAlert in the list (or the Marketplace install dialog).
2. **`/public/product/delivery-logs.png`** (replace) — The FormAlert sidebar with Webhook URL and Message fields filled in (configuration state, not log state).

Until these are available, existing images are used as placeholders with `TODO` comments in `app/page.tsx`.
