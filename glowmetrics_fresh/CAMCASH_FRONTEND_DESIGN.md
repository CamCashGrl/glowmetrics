# CamCash Frontend Design Authority

This document is the reusable design contract for any CamCash UI work. Load/paste
the block below before any UI-specific task so prompts can stay short and still
carry the full guardrail set.

## Master prompt block

```text
CAMCASH FRONTEND DESIGN AUTHORITY

CamCash already has an established visual identity. Do not redesign the product
from scratch and do not default to generic AI-generated SaaS patterns.

Treat the existing CamCash UI as the source of truth. Before implementing new UI,
inspect the surrounding components and reuse their established visual language,
spacing, typography, surfaces, buttons, pills, badges, shadows, gradients, hover
states, and responsive behavior.

CamCash should feel like a premium, futuristic creator-intelligence product: dark,
analytical, cinematic, compact, high-signal, and intentionally designed for cam
creators.

Avoid generic SaaS/admin-dashboard aesthetics, cookie-cutter card grids,
shadcn/Bootstrap defaults, white/gray panels, excessive rounded containers,
generic purple-gradient styling, fake avatars, unnecessary decorative UI,
excessive pills, excessive glow, and animation without meaning.

Use visual hierarchy intentionally. Dark/glass surfaces should carry most of the
interface; accent colors should communicate meaning and hierarchy rather than
decorate every element.

Use motion only when it improves comprehension, hierarchy, feedback, or perceived
responsiveness. Prefer a few meaningful micro-interactions over animation
everywhere.

Create atmosphere through the existing CamCash visual language rather than adding
large decorative gradients, blobs, particles, or visual noise.

Most importantly: the result should look like a natural evolution of CamCash, not
like a newly generated dashboard.

DATA + PRODUCT AUTHORITY

Existing analytics, calculations, business rules, gating, and user data are
authoritative.

Do not invent metrics, scores, thresholds, rankings, risk formulas, database
fields, fake data, fake avatars, or replacement analytics logic unless explicitly
approved.

When improving an existing feature, preserve its behavior and data flow unless the
task explicitly authorizes a behavioral change.

Design creativity is encouraged. Data invention is not.

For additive UI work, prefer extending existing components and patterns over
replacing or rewriting working systems.
```

## Reference — the existing visual language this points to

**Colors** (`app/dashboard/page.js`, `const C`):
`#05070f` bg · `#121826` card · `#161e2e` card2 · `#1e2d45` / `#2a3f5f` borders ·
`#7C5CFF` indigo · `#22D3EE` cyan · `#EC4899` pink · `#F59E0B` gold ·
`#60A5FA` blue · `#10B981` green · `#F87171` red · `#FB923C` orange ·
`#F1F5F9` white · `#94A3B8` text · `#475569` muted

**Tier colors** (`TIER_COLORS`): Whale → gold, Shark → blue, Regular → cyan, Dormant → orange.

**Glass card recipe** (`glassCard` object): `background: rgba(15,20,32,0.75)`,
`border: 1px solid rgba(255,255,255,0.08)`, `backdrop-filter: blur(20px)`.

**Typography**: `Syne`, `"Space Grotesk"`, sans-serif (set globally in `globals.css` body).

**Existing reusable patterns to check before adding anything new**: `.stat-card`,
`.stat-grid-4`, `.card-glow-pink`, `.card-glow-violet`, `.card-glow-gold`,
`.card-glow-cyan`, `.fan-card-grid`, `.data-table-wrap`, plus the scoped
`.fans-*` / `.fans-intelligence__*` classes in `app/dashboard/fans.css`.

## Product rules — Fan Intelligence specifically

Fan Intelligence is an additive layer over the existing Fans experience. It must
answer: **who matters most, what changed, and who needs attention** — using only
existing fan fields and existing analytics output (`lib/analytics.js`,
`identifyWhales`, `getCoachingBullets`).

Do not invent: a Fan Score, a Momentum Score, arbitrary thresholds, new ranking
systems, new risk formulas, new database fields, fake statistics, fake activity,
or fake avatars. Existing analytics logic is authoritative — design creativity is
welcome, data invention is not.
