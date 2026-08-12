# Decisions Log

This file records decisions made about the reading-plan dataset and app implementation,
including corrections to the source plan and any reversible choices made in the absence
of an explicit specification. See the Product/Engineering spec for the ground rules:
Codex (or any coding agent working on this repo) should record its rationale here
whenever it resolves an unspecified-but-reversible ambiguity, rather than deciding
silently.

## 2026-08-12 — Reading plan dataset corrections

Source: `Bible_Reading_Plan.pdf` (original, Jan 1 start) cross-referenced against
`Bible_Reading_Plan_Sept_Start.pdf` (adapted, Sep 1 start). Both were diffed
ordinal-by-ordinal (365 positions) to confirm the Sept 1 adaptation was transcribed
correctly; the only differences between the two were the intentional Gospel
Christmas-sequence swap at ordinals 113–116 and 356–359, exactly as documented in
the product spec. No other transcription drift was found.

Three data-integrity issues were then found in the underlying plan itself (present
in both the original and adapted PDFs, not introduced by the Sept 1 adaptation):

1. **Psalms 137–140 never read (12th-pass gap).** The plan's single-chapter entry
   ("Ps 136" with no range) at the position corresponding to Feb 26 in the Sept-start
   calendar dropped four chapters that a normal 5-chapter block would have covered.
   **Decision (user-directed):** Repaired. That entry now reads "Psalms 136–140."
   Verified: all 150 Psalms chapters are now read exactly 12 times across the year
   (1,800 total chapter-reads).

2. **Proverbs fell short of 12 full passes** (chapters 29–31 were each read only 11
   times instead of 12). The source plan's organic month-end catch-up logic drifted
   over the year and didn't consistently land on a clean reset.
   **Decision (user-directed):** The entire Proverbs stream was regenerated
   deterministically rather than patched: it resets to chapter 1 on the 1st of every
   calendar month, reads one chapter per day, and on the last day of the month reads
   from that day-of-month's chapter through chapter 31 inclusive (e.g., day 30 of a
   30-day month reads Proverbs 30–31; Feb 28 reads Proverbs 28–31). Verified: exactly
   372 total chapter-reads (12 × 31), zero gaps or overcounts.

3. **Matthew 1–2 and Luke 1–2 are read 5 times instead of 4** (all other Gospel
   chapters are read exactly 4 times). This is a side effect of the Christmas swap:
   fixing the Nativity narrative to Dec 22–25 inserts an extra occurrence of those
   chapters without removing the one that occurs naturally in the normal 4-pass
   rotation.
   **Decision (user-directed):** Left as-is. This is treated as an accepted
   characteristic of the plan rather than an error to fix. Documented here and in
   `src/data/reading-plan.json` under `corrections` so it's never mistaken for a future
   bug.

All three findings and the corrected dataset are recorded in
`src/data/reading-plan.json` (see the `corrections` array for machine-readable detail).
The dataset remains the single authoritative source of Scripture assignments per the
architecture principle in the spec — the app must never regenerate it from cadence
rules at runtime.

## 2026-08-12 — Phase 1 scaffold

Built the invisible foundation per the spec's first-task scope: project setup, PWA
config, routing shell, design-token scaffolding, Dexie/IndexedDB schema, the
injectable Clock service, and the full reading-plan domain model (dataset adapter,
calendar mapping, stream-shift model, schedule resolver), plus 24 tests covering all
of it.

A few reversible choices made along the way, recorded per the ambiguity-handling
process:

- **Routing library:** chose `react-router-dom` (not specified in the spec). It's the
  standard choice for a React SPA with the five fixed top-level destinations
  (Home/Read/Journal/Library/Prayer) and nothing about the spec suggests a reason to
  avoid it.
- **PWA plugin:** used `vite-plugin-pwa` to generate the manifest and service worker,
  since the spec calls for an installable PWA but doesn't specify tooling.
- **Calendar mapping implementation:** `baseDateForOrdinal` / `baseOrdinalForDate`
  walk day-by-day rather than using a closed-form calculation. For a 365-day plan this
  is cheap and, more importantly, it's easy to verify by inspection against the
  spec's leap-day rule. Can be optimized later if profiling ever shows a need.
- **`ordinalForEffectiveDate` performance:** currently scans the full reading year
  (O(365)) per call rather than maintaining a reverse index. Documented in the
  function's own comment as the first thing to optimize if it's ever called
  per-frame instead of per-navigation.
- **Font files not yet bundled:** `src/styles/fonts/` is scaffolded with instructions
  but no actual font files yet, since theming is a Phase 6 concern. The token file
  falls back to system fonts in the meantime so nothing looks broken.
- **PWA icon assets:** left as an empty placeholder array in `vite.config.ts` — no
  app icon exists yet and generating one is a design task, not a Phase 1 concern.

Nothing in this phase touches the authoritative dataset, destroys user data,
introduces a backend, or adds gamification — all out of bounds per the spec's
guardrails for autonomous decisions.

## 2026-08-12 — Phase 2: first usable milestone

Built the first real, tappable version of the app per the spec's own milestone
definition: today's readings resolve correctly, split by Morning/Evening, a reading
can be marked complete, a passage note can be written and saved, everything works
offline (IndexedDB only, no network calls anywhere in this phase), and shifting one
stream independently works and is provably isolated from the other four.

Reversible decisions made, recorded per the ambiguity-handling process:

- **Reading year bootstrapping:** Phase 2 has no start-date-picker UI yet, so the app
  auto-creates a single reading year on first launch, anchored to *today's* date
  rather than the spec's default September 1. This was chosen so the milestone is
  immediately usable the moment it's opened, regardless of what day that happens to
  be — waiting for a specific calendar date to test the first usable build didn't
  seem in the spirit of "first usable milestone." A proper start-date choice (and the
  spec's multi-Reading-Year support) is real, deferred work, not something this
  decision forecloses — everything is already keyed by `readingYearId`.
- **Default Morning/Evening assignment:** Psalms, Proverbs, and Gospel default to
  Morning; Old Testament and New Testament default to Evening. Arbitrary but
  reasonable starting point, fully user-reassignable from the Reading Desk, and only
  ever applied before the user has expressed a preference.
- **Time-of-day session default:** before noon shows Morning, noon or later shows
  Evening. Simple midpoint split; the user can always switch sessions manually
  regardless of this default.
- **Shift Stream delay increment:** each "Shift to tomorrow" action records a 1-day
  delay. If a stream falls behind on consecutive days, each action stacks another
  StreamShiftEvent (already proven to accumulate correctly in the Phase 1 tests)
  rather than requiring the user to specify a delay amount.
- **Completion control is a plain button, not the swipe gesture.** The spec's
  preferred interaction is a left-to-right swipe with a non-swipe fallback for
  accessibility; Phase 2 only needed to prove completion persists correctly, not the
  final interaction design, so only the accessible fallback was built. The swipe
  gesture itself belongs in Phase 3 alongside the rest of the Reading Desk's visual
  design.
- **Passage notes are plain, unstyled textareas.** Markdown rendering, tag parsing,
  and the "N previous encounters" indicator are Phase 4 concerns — Phase 2 only needed
  to prove a note ties to one specific encounter (not the passage generally), which
  is now covered by a test using two different ordinals for the same Matthew 5
  chapter.
- **No Threshold, Home, or Library screens are wired into navigation flow yet** —
  the nav bar links to them (from Phase 1) but they're still placeholders. Read is
  the only screen with real behavior in Phase 2.

All new domain and repository logic is covered by tests (13 new tests: repository
behavior, plus a component-level smoke test that renders the Reading Desk against a
real in-memory IndexedDB and confirms completion actually persists) — 37 total,
all passing. Production build verified clean.

## 2026-08-12 — Live deployment via GitHub Pages

The person testing this app is on iPad/phone only until their desktop is set up, and
GitHub Codespaces turned out to be impractical on a small touchscreen (no room to see
a terminal and type in it at once). Rather than requiring a dev environment to see
progress, the app now auto-deploys to a real URL on every push to `main`.

- **`.github/workflows/deploy.yml`** — runs the test suite, builds, and deploys to
  GitHub Pages on every push to `main` (and can be triggered manually). The build
  step running `npm run test` first means a broken build or failing test blocks
  deployment rather than shipping silently.
- **`vite.config.ts` `base` path** — set to `/bearing-the-color-of-scripture/` since
  GitHub Pages serves project sites from a subpath, not the domain root.
- **Switched from `BrowserRouter` to `HashRouter`** (`src/main.tsx`). GitHub Pages is
  static hosting with no server-side rewrite rules, so a hard refresh on a route like
  `/read` would 404 under `BrowserRouter`. Hash-based routes (`/#/read`) always
  resolve to `index.html` first, avoiding that. Worth switching back to
  `BrowserRouter` if this ever moves to a host with SPA rewrite support (Netlify,
  Vercel, etc.) — noted here so that migration isn't a mystery later.
- **Fixed a real test flake this surfaced:** the Read-screen smoke test asserted on
  Morning-session stream labels ("Psalms"/"Gospel") specifically, which don't render
  at all when the test happens to run after noon and the app defaults to the Evening
  session. Fixed to assert on something session-agnostic (the presence of any
  "Mark complete" button) instead. This was a real bug in test reliability, not a
  reason to distrust the underlying app logic — but it would have caused confusing,
  time-of-day-dependent CI failures if it had shipped as-is.
- **First deploy failed at the `npm run test` step in CI** (green locally, red on
  GitHub's runner). Diagnosed by reproducing a clean `npm ci` install locally, which
  passed — pointing at an environment difference rather than a code or test problem.
  The actual cause: Vite 8.x and Vitest 4.x both declare a minimum Node engine of
  `^20.19.0` (Vite) and `^20.0.0 || ^22.0.0 || >=24.0.0` (Vitest). The workflow's
  `node-version: 20` resolves to whichever 20.x patch is currently latest on the
  runner — if that patch happened to sit below `20.19.0`, Vite hard-fails its own
  engine check before anything else can run. Pinned to Node 22 instead, which this
  project has already been developed and tested against directly, removing the
  ambiguity.

Once GitHub Pages is enabled in the repository's settings (Settings → Pages →
Source: GitHub Actions — a one-time manual step), the live URL is:
`https://cheeriothief.github.io/bearing-the-color-of-scripture/`

## 2026-08-12 — Phase 3: real Reading Desk visual design

Three concrete theme directions (Prayer Book, Candlelight, Minimal — names and fonts
already fixed by the spec) were mocked up side by side against the real layout before
any of this was built for real, so the visual direction was chosen deliberately rather
than defaulted into. Decision: **Prayer Book is the default theme; all three are
available and switchable from a Settings screen.**

What got built for real (not mockup) this phase:

- **Theme system**: `src/styles/tokens.css` now defines three complete token sets
  keyed by `data-theme` on `<html>`, applied live from a persisted setting
  (`src/services/settingsRepo.ts` — `getTheme`/`setTheme`, default `"prayerbook"`).
- **Settings screen** (`src/routes/Settings.tsx`): reachable via a gear icon in the
  app header, deliberately NOT added to the primary bottom nav — the spec fixes that
  nav list at exactly Home/Read/Journal/Library/Prayer, so Settings needed a separate
  entry point rather than becoming a sixth item.
- **Responsive Reading Desk layout** (`src/routes/readingDesk.css`): one CSS
  breakpoint (768px) switches between phone single-column (list and notebook are
  mutually exclusive full-screen views, with a "Back to readings" control) and tablet
  two-pane (both always visible, roughly one-third list / two-thirds notebook), per
  the spec's tablet-vs-phone layout description. This is pure CSS, not JS device
  detection.
- **Swipe-to-complete gesture**: implemented with raw touch event handlers
  (touchstart/touchmove/touchend) tracking left-to-right drag distance, with a
  73px-ish threshold before firing completion. A same-row "Mark complete" button
  remains as the required non-swipe fallback for accessibility and to avoid
  edge-swipe conflicts — both call the same `toggleCompletion` function, so there's
  exactly one source of truth for what "complete" means.
- **Real "N previous encounters" indicator**, not a mockup number:
  `findPriorOrdinalsWithSameReference` (domain/datasetAdapter.ts) finds every earlier
  ordinal in the same stream where the dataset assigned the exact same book and
  chapter range, and `countEngagedEncounters` (services/encounterActions.ts) checks
  how many of those the user actually has an encounter row for. Covered by a test
  that specifically exercises the Matthew 1 Christmas-swap duplicate (ordinal 114)
  correctly linking back to its first occurrence (ordinal 1) — a nice callback to the
  dataset-correction work from the very first session on this project.

Reversible decisions:

- **Settings reached via header gear icon, not a route named in primary nav.** See
  above — this doesn't violate the spec's fixed nav list since it's a secondary
  entry point, the same way Progress lives inside Library rather than its own nav
  item.
- **Swipe threshold of ~73px** is a starting guess, not derived from anything in the
  spec. Easy to tune once tested on a real device — noted here so a future
  adjustment isn't a mystery.
- **Tablet breakpoint at 768px** — a standard tablet-ish width; nothing in the spec
  pins an exact number.
- **"Previous encounters" counts engaged encounters only** (rows that exist because
  the user completed or noted them), not every calendar occasion the dataset
  scheduled that passage. A passage the plan schedules four times but the user only
  ever completed once shows "1 previous encounter," not "3." This matches the
  spirit of the feature — it's about the user's own history with a passage, not the
  plan's cadence — but is worth flagging as an interpretation, not an explicit spec
  rule.

8 new tests (previous-encounters logic, theme persistence) plus 2 existing smoke
tests updated to disambiguate "Mark complete" appearing twice per row now (the
swipe-hint overlay text and the real button) — 45 tests total, all passing.
Production build verified clean.
