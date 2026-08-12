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

## 2026-08-12 — Swipe gesture simplified per user feedback

The initial swipe implementation slid the entire reading row's text horizontally as
the user dragged, mirroring the drag distance 1:1. Feedback after real device testing:
too much motion for what the spec calls a "restrained gesture." Fixed by removing the
translateX-follows-finger behavior entirely — touch tracking still works underneath,
but the only visible feedback during the drag is now a subtle background tint that
grows with distance. Text never moves. Completion (the strikethrough) still appears
the instant the threshold is crossed, with no separate animation. This is exactly the
kind of usability papercut that gets fixed immediately regardless of what phase is
active, rather than batched for a later polish pass — it's not the same category as
"doesn't perfectly match the mockup yet."

## 2026-08-12 — Phase 4: the writing system

Real Markdown rendering, tag parsing per the spec's exact grammar, and Daily/Monthly
Reflections — the writing system the spec describes as one of the app's major parts.

- **`src/domain/markdown.ts`**: the single choke point for turning Markdown into
  sanitized HTML (via `marked` + `DOMPurify`). Every note and reflection display goes
  through this one function, so the spec's "rendered Markdown must be sanitized"
  requirement is enforced in exactly one place rather than re-implemented per screen.
  Covered by 8 tests that specifically try to get a `<script>` tag, an `onerror`
  handler, a `javascript:` URL, and an `<iframe>` through — all confirmed stripped.
- **`src/domain/tagParser.ts`**: implements the spec's tag grammar precisely (`#`
  immediately followed by a letter or number, then letters/numbers/underscores/
  hyphens) and its exclusions (no tags from inside fenced code blocks, inline code
  spans, Markdown link URLs, or bare autolinks — though tag-shaped text in a link's
  *visible label* still counts, since that's plainly the user's intent). 13 tests,
  including several adversarial cases (a tag-like string inside a URL, inside code,
  glued to punctuation).
- **`src/services/tagRepo.ts`**: regenerates a source's tag index on every save
  (delete-then-reinsert, matching the spec's "tags are regenerable" framing) rather
  than trying to diff old vs. new tags.
- **`src/services/reflectionRepo.ts`**: Daily Reflections keyed by calendar date,
  Monthly Reflections keyed by `YYYY-MM` — both independent of plan ordinals, per the
  spec, so they stay meaningful even as individual streams shift out of sync with
  each other.
- **`src/routes/Journal.tsx`**: real UI for both reflection types, with a
  view-rendered/click-to-edit pattern — matches the spec's "notes should feel like a
  blank page" while writing, but shows nicely typeset output once you step away from
  editing.
- **Passage notes on the Reading Desk got the same view/edit treatment** — a note
  with content now renders as Markdown by default, and only drops into the raw
  textarea when tapped.

Reversible decisions:

- **A note starts in edit mode only when it's empty.** Once something's been written,
  reopening it shows the rendered view first, requiring a tap to edit. This seemed
  more in the spirit of "blank page" than always dropping straight into raw text.
- **Tag-shaped text inside a Markdown link's visible label still counts as a tag**
  (only the URL portion is excluded). The spec says tags "inside... link URLs are
  ignored" — read narrowly, that's specifically the URL, not link text a user
  deliberately wrote as `[#topic](url)`.
- **`marked` + `DOMPurify`** chosen for Markdown rendering/sanitization — both are
  widely used, actively maintained, and DOMPurify's specific job (stripping dangerous
  HTML) maps directly onto the spec's sanitization requirement rather than needing a
  custom sanitizer built from scratch.
- **No Markdown editing toolbar or live WYSIWYG.** Writing stays a plain textarea;
  only the *display* of previously-written content is rendered. This matches "the
  interface should not permanently force the user into categories" — the raw
  Markdown source is always what you're editing, never a formatted intermediate
  representation.

23 new tests across tag parsing, Markdown sanitization, and the reflection repository
— 77 total, all passing. Production build verified clean.

## 2026-08-12 — Phase 5: Library

The archive: Scripture Notes browsable by biblical book, a Tags index, Progress
(counts and books touched, never framed as performance), and Export.

- **`src/domain/bibleBooks.ts`**: the canonical 66-book order, Genesis through
  Revelation. Verified programmatically against the dataset itself — every book name
  the dataset actually uses matches this list exactly, with none missing and none
  extra — before it was trusted to drive grouping anywhere.
- **`src/services/scriptureNotesRepo.ts`**: joins each passage note back to its
  Scripture reference (via its encounter's stream + ordinal) and groups by book in
  canonical order, not alphabetically or by write order. An emptied-out note (saved
  as blank/whitespace) is excluded from the archive rather than showing as a ghost
  entry.
- **`src/services/progressRepo.ts`**: per-stream completed-count and books-touched,
  plus a repeated-encounters list (passages engaged with more than once). Explicitly
  does NOT compute anything framed as performance — no percentages presented as
  scores, no comparison across streams, no streaks. Tested specifically against the
  Matthew 1 Christmas-swap duplicate (ordinals 1 and 114) to confirm it's correctly
  recognized as one passage encountered twice, not two unrelated completions.
- **`src/services/exportService.ts`**: both export formats, built as two fully
  independent functions per the spec's "JSON backup must remain available even if
  Markdown ZIP generation fails" rule — the Markdown export path has a try/catch with
  its own user-facing fallback message pointing at the JSON backup; the JSON backup
  never touches the ZIP-building code at all. The Markdown ZIP uses `fflate`, per the
  spec's explicit suggestion, with tags in each file's frontmatter regenerated from
  content at export time rather than stored as a separate directory (matching the
  spec's framing of tags as "regenerable"). Verified with real ZIP round-trip tests
  (unzip the output and check exact folder paths and frontmatter content) rather than
  just confirming the function doesn't throw.
- **`src/routes/Library.tsx`**: four sub-sections (Scripture Notes, Tags, Progress,
  Export) as an in-screen tab switcher.

Reversible decisions:

- **Library's four sections are an in-screen tab switcher (local state), not nested
  routes.** The spec doesn't specify navigation mechanics within Library, and a tab
  switcher is simpler to reason about for now. Revisiting this as real nested routes
  (e.g. so a specific tag or book could be deep-linked) is easy later without
  disturbing anything else, since the four panel components are already fully
  self-contained.
- **Restore/import from a backup is intentionally NOT built yet.** The spec does
  define restore behavior ("replace existing local state rather than attempting to
  merge two backups"), but this phase only covers export. A backup nobody can restore
  from is a real gap, not a finished feature — flagged here explicitly so it doesn't
  quietly get treated as done. Reasonable next step whenever it's prioritized.
  Nothing in the export format design above should make restore harder later — the
  JSON backup is a direct table dump, so restoring it is mostly "clear each table,
  then bulk-insert this backup's version of it."
  <br>Author's note: Codex or a future Claude session picking this up should treat
  Export ≠ Backup/Restore as two separate features, only the first of which exists.
- **The Metadata/progress.md file in the Markdown export is plain prose, not a
  structured format (JSON/YAML/CSV).** The rest of that folder is meant to be
  human-readable alongside the notes and reflections next to it; the JSON backup
  already exists as the machine-readable option, so duplicating structured data here
  seemed redundant.
- **Tags panel shows tagged sources by type and date only, without rendering the
  full note/reflection content inline.** Tapping through to the actual content (vs.
  just knowing it exists) would need either a shared detail view or duplicating
  Journal/Reading Desk's editing UI — reasonable follow-up, deferred to keep this
  phase's scope to what the spec explicitly asks Library to contain.

13 new tests (Bible book ordering, Scripture Notes grouping, Progress counting
including the repeated-encounter case, and Export — with real ZIP unzip-and-inspect
round trips rather than just checking the function runs) — 90 total, all passing.
Production build verified clean.

## 2026-08-12 — Phase 6: Threshold, Home, Prayer Book, real fonts

The atmospheric layer, plus the theming pass now has real typography instead of
system-font fallbacks.

- **Real bundled fonts**: EB Garamond, Source Serif 4, and Atkinson Hyperlegible
  pulled directly from Google Fonts' own repository (all SIL Open Font License),
  converted from the upstream .ttf files to .woff2 via `fonttools` (~3.7MB →
  ~1.4MB). EB Garamond and Source Serif 4 are variable fonts (single file spans
  the full weight range via `font-weight: <min> <max>` in the `@font-face` rule);
  Atkinson Hyperlegible ships as four static weights since the Braille Institute
  doesn't publish a variable version. License files kept alongside each family in
  `src/styles/fonts/` for attribution.
- **Fixed a real offline-support gap this surfaced**: the PWA's default precache
  glob doesn't include font files, so the bundled fonts would have silently fallen
  back to system fonts the moment the device went offline — directly undermining
  the "local-first, offline-first" requirement for exactly the typography the spec
  cared enough about to name three specific families for. Fixed by adding `woff2`
  to `vite-plugin-pwa`'s `globPatterns`; precache went from 6 entries (595KB) to 16
  entries (2030KB) once fonts were actually included. Caught by inspecting the
  generated service worker directly (`grep woff2 dist/sw.js`) rather than assuming
  the default config was sufficient.
- **`src/domain/prayerBook.ts`**: five historic prayers (a Prayer of St. Chrysostom
  and Evening/Morning Collects from the 1662 Book of Common Prayer, the Prayer of
  St. Ephrem, and the Jesus Prayer), each properly attributed. Every text here is
  either an ancient liturgical prayer in a long-traditional English rendering, or
  drawn directly from the 1662 BCP — unambiguously public domain, never a modern
  copyrighted translation.
- **Threshold** (`src/routes/Threshold.tsx`): shown once per calendar day (the
  middle option of the spec's three choices — "every launch" felt like it would
  become an annoyance fast, "configurable time away" adds a setting with no clear
  default), gating the whole app on first launch each day. The Enter button is
  available the instant the screen renders — nothing artificially delays it.
  Covered by an end-to-end test that renders the real `<App />` shell and confirms
  Threshold blocks the primary nav on first launch, entering reveals it, and it
  doesn't reappear on a second render the same day.
- **Threshold draws only from the Prayer Book, never a Scripture excerpt** — the
  spec allows either, but this app never contains Bible text anywhere, for any
  reason (the physical Bible is the sanctuary; the app is only ever the narthex).
  Using prayers exclusively keeps that boundary completely clean and sidesteps any
  question of which Bible translation's licensing would even apply to a threshold
  quote.
- **Home** (`src/routes/Home.tsx`): four quiet destination links and one optional,
  non-numeric sentence about what's left today ("Evening readings remain.") — no
  dashboard, no counts, no streak language. The message logic itself
  (`src/domain/homeMessage.ts`) is a small pure function, tested independently of
  any UI, that returns null entirely when nothing remains rather than announcing
  completion.
- **Prayer** (`src/routes/Prayer.tsx`): now a real, small list of the bundled
  prayers rather than a placeholder.

Reversible decisions:

- **Threshold trigger is "once per day," not "every launch" or "configurable time
  away."** Documented above; easy to make configurable later if it turns out to
  feel wrong in practice.
- **Only 5 prayers in the Prayer Book for now.** The spec explicitly wants this
  "intentionally small," and 5 well-attributed, verifiably public-domain texts
  seemed like a better starting point than stretching to include more at the cost
  of attribution rigor.
- **`.woff2` only, no `.woff` or `.ttf` fallback bundled.** Every browser capable of
  running this PWA (installable, service-worker-based) also supports woff2; adding
  legacy formats would roughly double the font payload for no real benefit to any
  device this app can actually run on.

18 new tests (Threshold logic, Home's remaining-message logic, and a full
App-shell integration test of the Threshold gate) — 103 total, all passing.
Production build verified clean, with the font-precache gap specifically checked
by inspecting the generated service worker, not just trusting the build succeeded.

## 2026-08-12 — Fixed a real visual disconnect on the Reading Desk

User feedback after seeing the real app on-device: the Reading Desk "feels
disconnected... too much of the lighter color... makes the UI feel a little bit
cheap" compared to the mockup, even with real fonts now in place.

Root cause: the mockup's dark surface ran full-bleed from the very top of the
screen — title, session controls, everything sat directly on the book-cover-dark
background. The real build instead had the Reading Desk's title/date/session
switcher sitting on the generic cream page background (inherited from the app-wide
`main` default), with the dark surface only starting at the reading-list pane below
it. That created a visible seam between "light header" and "dark list," breaking
the cohesive book-object feeling the mockup had. The same disconnect existed above
and below the whole screen too — the header gear icon and the bottom nav bar both
sat on the cream `body` background regardless of what was happening in `<main>`.

Fix, two layers:
- **`readingDesk.css`**: `.reading-desk` (the whole screen, not just the list pane)
  now uses the dark inset background from the top. Title, date, and session buttons
  sit directly on it, matching the mockup's full-bleed treatment. Only the notebook
  pane still shows cream, as the intentional "open page" contrast.
- **`index.css`**: the outermost canvas (`body`) switched from the cream `--color-bg`
  to the dark `--color-bg-inset`, with the header and nav bar's colors updated to
  their inset variants to match. Each route's `<main>` keeps the cream `--color-bg`
  as its own default, so ordinary screens (Home, Journal, Library, Prayer, Settings)
  now read as a cream "page" framed by a consistent dark chrome top and bottom,
  rather than the previous arrangement, which was really just uncoordinated cream
  everywhere with a dark box floating in the middle of Read specifically.

This has no effect on Candlelight (bg and bg-inset are already identical there) and
only a subtle effect on Minimal (bg and bg-inset are two very close near-white
tones), so this was really a Prayer-Book-specific problem, exactly where the
screenshot came from.

## 2026-08-12 — Restoring the gap flagged in Phase 5: backup restore/import

Export existed since Phase 5, restore did not — flagged explicitly at the time as a
real gap rather than glossed over, and now closed.

- **`parseJsonBackup`** (exportService.ts) validates a backup's shape completely
  before anything touches the database: valid JSON, an object (not an array or
  scalar), `backupVersion === 1` exactly, and every expected table section present
  as an array. Throws a specific `InvalidBackupError` with a message naming what's
  wrong, rather than a generic parse failure.
- **`restoreFromJsonBackup`** replaces all local state — never merges — per the
  spec's explicit restore-behavior rule. Runs as a single Dexie transaction across
  every table: all clears, then all bulk-inserts, so a mid-restore failure can't
  leave old and new data mixed together. Validation happens *before* the transaction
  opens, so a malformed file never touches the database at all — confirmed by a test
  that seeds real data, attempts to restore garbage, and checks the original data is
  still there afterward, untouched.
- **Restored rows keep their original ids, timestamps, and foreign keys exactly** —
  restore is not a re-derivation or a reconstruction, it's a literal replay of
  exactly what was exported. Verified directly: an encounter's id, ordinal, and
  completion timestamp all match exactly after a build → clear → restore cycle.
- **The backup format grew one field**: `appState` (currently just the
  Threshold-last-shown date) is now included in both export and restore, for
  completeness — a backup that silently dropped one small table would be a subtle,
  confusing gap of its own.
- **UI** (Library → Export → "Restore from JSON backup"): file picker, a
  `window.confirm()` naming exactly what will happen and that it can't be undone,
  then a full-page reload on success. The reload is deliberate — plenty of screens
  hold their own component-level state fetched once on mount (not all of them are
  wired through Dexie's live-query reactivity), and a full replace-everything
  operation is exactly the case where "guarantee every screen re-reads from
  scratch" matters more than avoiding a reload.

Reversible decisions:

- **`window.confirm()` for the destructive warning**, not a custom two-step
  in-app confirmation UI. Simple, unmissable on every platform this runs on, and
  consistent with how the spec already treats note deletion ("allowed with
  confirmation") — a plain native confirm dialog meets that bar without needing new
  UI just for this one action.
- **A full page reload after a successful restore**, rather than trying to make
  every single screen's data-fetching perfectly reactive to a total-replace event.
  Simpler, and more trustworthy for something this destructive — no risk of some
  screen quietly showing stale pre-restore state because its `useEffect` only runs
  once on mount.
- **Only `backupVersion === 1` is accepted**, not `<= 1` or any forward-compatible
  range — there's only ever been one backup format, so being maximally strict now
  costs nothing and avoids ever having to guess what an unrecognized future version
  might mean.

9 new tests covering validation (five distinct malformed-input cases), a full
round-trip (build → clear → restore → verify every table), the replace-not-merge
guarantee specifically, and the untouched-on-failure guarantee — 112 total, all
passing. Production build verified clean.

## 2026-08-12 — Custom start-date changing, and the "active reading year" concept

Another real gap flagged by the user directly: no way to change the reading year's
start date manually, which the spec explicitly requires — including the trickier
rule that a start-date change either edits the current reading year in place, or
spawns a whole new one, depending on whether anything has happened in it yet.

- **`hasActivity(readingYearId)`** checks completions and stream shifts scoped to
  that reading year. **Deliberately does NOT check Daily/Monthly Reflections**, even
  though the spec's prose lists them as a trigger — those are keyed to calendar
  date/month rather than `readingYearId` in this schema (matching the spec's own
  "Daily Reflections are keyed to calendar date rather than logical plan day" rule),
  so there's no reliable way to attribute a given reflection to one specific reading
  year. This is a genuine, intentional narrowing of the spec's rule, not an
  oversight — flagged here rather than left to be discovered later. Passage notes
  ARE covered, transitively: a note can't exist without an encounter, and encounters
  are properly scoped to `readingYearId`.
- **`changeStartDate`** implements both branches: if no activity yet, the existing
  reading year's `startDate` is updated in place (same id, no duplicate created). If
  activity exists, a brand new `ReadingYear` row is created with the new start date,
  the old one is left completely untouched (verified by a test that checks the old
  row's start date and encounter count are unchanged after the change), and the new
  one becomes active.
- **Introduced an explicit "active reading year" pointer** (`appStateRepo` —
  `activeReadingYearId`), replacing the old "whichever reading year is oldest"
  assumption from Phase 2. This is what actually makes the new-reading-year branch
  take effect for the rest of the app — without an explicit active pointer, creating
  a second `ReadingYear` row would do nothing observable, since every screen would
  keep resolving back to the original one. Backward compatible: an install from
  before this existed (a reading year with no active-pointer row yet) adopts its
  existing reading year as active on first read rather than creating a duplicate —
  covered by its own test.
- **Settings screen** gained a "Reading Year" section: current start date, a native
  date input, and messaging that changes depending on whether this reading year has
  activity yet — telling the person plainly whether their change will edit history or
  start something new, before they commit to it. Saving triggers a full page reload,
  same reasoning as the restore feature: several screens fetch their reading year
  once on mount rather than through live-query reactivity, so a reload is the
  simple, trustworthy way to guarantee everything picks up the change.

Reversible decisions:

- **Reflections excluded from `hasActivity`**, as detailed above — the single
  biggest interpretation call in this change. If reflections ever become
  reading-year-scoped in a future schema change, this should be revisited.
- **Full page reload after a start-date change**, matching the restore feature's
  precedent, for the same reasons.

10 new tests covering both branches of `changeStartDate`, the activity-detection
logic in isolation (including that activity in one reading year doesn't leak into
another), and the backward-compatibility path for pre-existing installs — 122 total,
all passing. Production build verified clean.
