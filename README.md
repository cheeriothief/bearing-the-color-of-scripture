# Bearing the Color of Scripture

A tablet-first, local-first Bible reading companion. The app is the narthex;
the physical Bible is the sanctuary — this app never contains Scripture
itself, it helps you keep rhythm with a physical Bible you read separately.

See `DECISIONS.md` for the project's decision log, including corrections
made to the reading-plan dataset and the rationale behind them.

## Status: Phase 1 — invisible foundation

There is no real UI yet, on purpose. This phase is the plumbing everything
else depends on: the local database, the reading-plan domain model, the
calendar/shift engine, and the tests that prove it's correct. Full UI work
starts once this foundation is trusted.

What exists right now:

- **`src/data/reading-plan.json`** — the authoritative 365-day dataset (see
  `DECISIONS.md` for how it was validated and corrected)
- **`src/domain/`** — the reading-plan domain model:
  - `datasetAdapter.ts` — loads and validates the dataset; the only file
    that reads the JSON directly
  - `calendarMapping.ts` — ordinal ↔ calendar date mapping, including the
    Feb 29 "no new reading" rule
  - `streamShift.ts` — the auditable `StreamShiftEvent` model; each of the
    five streams can fall behind independently
  - `scheduleResolver.ts` — resolves "what should stream S show on date D",
    the function everything else will build on
- **`src/services/clock.ts`** — an injectable Clock, so time-dependent logic
  (leap years, month boundaries) is testable without faking the system
  clock everywhere
- **`src/services/database.ts`** — the Dexie/IndexedDB schema, including
  lazy encounter creation (rows are only created when a reading is actually
  completed or noted, never pre-generated on onboarding)
- **`tests/`** — 24 tests covering the dataset, calendar mapping (including
  leap-year edge cases), stream shifting, and the schedule resolver

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
