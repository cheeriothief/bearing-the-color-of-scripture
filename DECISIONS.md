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
