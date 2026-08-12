# Bearing the Color of Scripture

A tablet-first, local-first Bible reading companion. The app is the narthex;
the physical Bible is the sanctuary — this app never contains Scripture
itself, it helps you keep rhythm with a physical Bible you read separately.

See `DECISIONS.md` for the project's decision log, including corrections
made to the reading-plan dataset and the rationale behind them.

## Status: Phase 5 — Library

The archive is real: Scripture Notes browsable by biblical book, a Tags
index, a restrained Progress view (counts and books touched, never
performance), and Export (both a human-readable Markdown .zip and a
machine-readable JSON backup).

What's new since Phase 4:

- **`src/domain/bibleBooks.ts`** — canonical 66-book order, verified to
  exactly match every book name the dataset actually uses
- **`src/services/scriptureNotesRepo.ts`** — passage notes grouped by book
- **`src/services/progressRepo.ts`** — per-stream completion counts, books
  touched, and repeated-encounter tracking
- **`src/services/exportService.ts`** — Markdown ZIP export (via `fflate`)
  and JSON backup, kept fully independent of each other per the spec
- **`src/routes/Library.tsx`** — the four sections as an in-screen tab
  switcher
- **13 new tests**, including real ZIP round-trip verification — 90 total,
  all passing

**Known gap, called out explicitly rather than glossed over:** there is no
restore/import from a backup yet — only export. See `DECISIONS.md` for why
that's a deliberate scope boundary for this phase, not an oversight.

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
