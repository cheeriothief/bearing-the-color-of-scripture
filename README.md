# Bearing the Color of Scripture

A tablet-first, local-first Bible reading companion. The app is the narthex;
the physical Bible is the sanctuary — this app never contains Scripture
itself, it helps you keep rhythm with a physical Bible you read separately.

See `DECISIONS.md` for the project's decision log, including corrections
made to the reading-plan dataset and the rationale behind them.

## Status: Phase 6 — Threshold, Home, Prayer Book, real fonts

The atmospheric layer is real now, and the theming pass has actual
typography — EB Garamond, Source Serif 4, and Atkinson Hyperlegible are
bundled and self-hosted, not falling back to system fonts.

What's new since Phase 5:

- **Real bundled fonts** (`src/styles/fonts/`) — pulled from Google Fonts'
  own repository, converted to .woff2, properly licensed (SIL OFL)
- **Fixed a real offline gap**: the PWA precache didn't include font files
  by default, which would have silently broken offline typography — see
  `DECISIONS.md` for how this was caught and fixed
- **`src/domain/prayerBook.ts`** — 5 historic, properly attributed prayers
  (all verifiably public domain: 1662 Book of Common Prayer texts and
  ancient liturgical prayers in traditional renderings)
- **`src/routes/Threshold.tsx`** — shown once per day, gates the app on
  first launch, Enter available immediately, draws only from the Prayer
  Book (never Scripture — the app never contains Bible text, anywhere)
- **`src/routes/Home.tsx`** — atmospheric, four quiet destinations, one
  optional non-numeric sentence about what's left today
- **`src/routes/Prayer.tsx`** — now real content instead of a placeholder
- **18 new tests**, including a full App-shell integration test of the
  Threshold gate — 103 total, all passing

**Restore is now implemented too** (Library → Export → "Restore from JSON
backup") — the gap flagged after Phase 5 is closed. Restore fully replaces
local state per the spec (never merges), runs as a single atomic
transaction, and validates the backup's shape before touching the database
at all, so a malformed file can't leave things half-changed.

**Custom start date is now implemented too** (Settings → Reading Year) —
edits in place before any activity exists, spawns a new Reading Year
(preserving the old one) once it does, exactly per the spec's rule. See
`DECISIONS.md` for the one deliberate narrowing of that rule (Daily/Monthly
Reflections aren't currently reading-year-scoped, so they don't factor
into the activity check).

## Running it

```bash
npm install
npm run dev          # local dev server
npm run test         # run the test suite once
npm run test:watch   # run tests in watch mode
npm run build        # typecheck + production build
```

## Project shape

This is a Progressive Web App: React + TypeScript + Vite, IndexedDB via
Dexie, no backend, no account system, no cloud sync. Everything works
offline by design. See the spec documents (kept outside this repo) for the
full product vision — Reading Desk, Threshold, the writing system, Prayer
Book, and so on — most of which arrives in later phases.
