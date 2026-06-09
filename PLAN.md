# Internetree

> One **oak**. The whole internet keeps it alive together. Tend it or it wilts;
> abandon it and it dies — for real, forever — then it drops an acorn and the next
> generation begins.

**Tree = oak** (acorn = the lineage seed; oaks live centuries = the longevity goal;
broad crown = communal shade). Art = **soft storybook**. Rendering is **anatomical,
not scaled**: a real per-stage skeleton (tapered trunk → branch orders → tip-clustered
crown → surface roots), so growth *adds structure* rather than inflating one blob.

A communal living thing. The pull is a fragile creature that depends on
strangers showing up. The share trigger isn't a brag — it's a plea: when you've
given all the care you can, the only way to help more is to **bring someone new.**

---

## Locked design (15 decisions, grilled)

### Core model
- **Two axes.** *Health* = recoverable mood (care ↑, neglect ↓). *Growth* =
  one-way monument (size/age, never decreases).
- **Coupled.** Growth buys resilience — sprouts are fragile, ancient trees hardy
  (slower health decay, longer death-grace).
- **Growth is hybrid** — accrues from *care received, only while healthy.* Size =
  collective effort, not clock time.

### The loop
- **Rate-limited care.** A tend gives a fixed health bump, then cooldown. Only a
  *crowd of distinct people* sustains it. **Hitting your limit = the share
  prompt** ("bring someone new"). This is the viral engine.
  *(Rate-limit is a driver/server concern, NOT in the pure engine.)*
- **Death = critical + grace.** Health bottoming out triggers a visibly *dying*
  state (trembling, draining, no clock); still rallyable. Only sustained
  abandonment past the grace window kills it. Grace scales with growth.
- **Rebirth.** Death → mourning/memorial (life stats = the shareable artifact) →
  auto-plant a fresh sprout (growth resets, **generation number carries**).
  Persistent **graveyard/timeline** of every past tree.

### People & integrity
- **Anonymous, no accounts ever.** Instant first touch; device ID for
  cooldown + personal stats only.
- **Anti-abuse, lenient/layered.** Device cooldown + high IP flood-ceiling.
  CAPTCHA (Turnstile) only if real abuse appears.

### Feel
- **Tempo: slow/ambient.** Hours to decay, weeks–months to live. Calm, not
  nagging. Liveliness comes from *seeing others*, not your own bar moving.
- **Onboarding: show-don't-tell.** Living tree + visible crowd + one obvious
  affordance. One ambient line of framing, max.
- **Other people = motes of light.** Each present stranger a soft glow; a tend
  flares it and stirs the leaves. Scales as meaning.
- **Visuals: SVG + GSAP.** *Growth = milestone stages* (seed → sprout → sapling →
  young → mature → ancient, each promotion celebrated). *Health = mood layer*
  (posture/colour) on top.
- **Sound: ambient, opt-in, off by default.** Later layer, not MVP-core.

### Architecture
- **Supabase.** Server-authoritative state. **Lazy/derived decay**
  (`{state, timestamp}`, computed on read — no ticking server, can't desync).
  Atomic server-side tend with rate-limit. Realtime + Presence.

---

## Build cut — one engine, two drivers (SSOT)

### Stage 1 (current)
1. **TDD the pure tree engine** — plain functions, no React, no network.
   `project(state, now)` advances health/critical/death/rebirth; `tend(state, now)`
   applies a care bump + growth. All rules proven by tests *first*.
2. **Render with SVG + GSAP** — milestone stages + health mood-layer.
3. **Local life-cycle harness** — fakes time + tends so we watch a full
   life → death → Gen 2 cycle on screen in seconds. **No Supabase.**

### Stage 2 (next)
- Swap the local driver for Supabase (**engine unchanged**).
- Realtime + Presence + motes, server-side tend/rate-limit function,
  IP flood-ceiling, graveyard/timeline.

---

## Open (do not block Stage 1)
- **Name** — "Evergreen" is a placeholder. Decide before Stage 2.
- **Numeric tuning** — cooldown, decay rate, stage thresholds, grace, mourning.
  Provisional values in Stage 1; tune by feel.

## Principles
TDD always (tests first). KISS, SOLID, DRY, SSOT. Mobile-first. Tailwind XOR CSS —
never mixed. The engine is the single source of truth, reused verbatim in Stage 2.
