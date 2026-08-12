# Bearing the Color of Scripture

A tablet-first, local-first Bible reading companion. The app is the narthex;
the physical Bible is the sanctuary — this app never contains Scripture
itself, it helps you keep rhythm with a physical Bible you read separately.

See `DECISIONS.md` for the project's decision log, including corrections
made to the reading-plan dataset and the rationale behind them.

## Status: Phase 3 — real Reading Desk visual design

The Reading Desk now has a real visual identity, not placeholder styling.
Three theme directions from the spec (Prayer Book, Candlelight, Minimal)
are fully implemented and switchable from Settings, with Prayer Book as
the default. The layout is genuinely responsive — phone gets a
single-column list with notes on their own screen, tablet gets the
one-third/two-thirds split with both panes always visible — and reading
completion works via an actual swipe gesture, with an accessible button
fallback.

What's new since Phase 2:

- **`src/styles/tokens.css`** — three complete theme token sets
- **`src/routes/Settings.tsx`** — theme picker, reached via a gear icon in
  the header (not the primary nav — see `DECISIONS.md` for why)
- **`src/routes/readingDesk.css`** — the responsive phone/tablet layout
- **Swipe-to-complete** in `src/routes/Read.tsx`, alongside the existing
  button-based completion
- **Real previous-encounters tracking** —
  `findPriorOrdinalsWithSameReference` in the domain layer plus
  `countEngagedEncounters` in the repository layer, not a mockup number
- **8 new tests** — 45 total, all passing

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
