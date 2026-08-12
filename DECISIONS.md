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
   `data/reading-plan.json` under `corrections` so it's never mistaken for a future
   bug.

All three findings and the corrected dataset are recorded in
`data/reading-plan.json` (see the `corrections` array for machine-readable detail).
The dataset remains the single authoritative source of Scripture assignments per the
architecture principle in the spec — the app must never regenerate it from cadence
rules at runtime.
