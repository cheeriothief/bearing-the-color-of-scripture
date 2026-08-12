# Bearing the Color of Scripture

A tablet-first, local-first Bible reading companion. The app is the narthex;
the physical Bible is the sanctuary — this app never contains Scripture
itself, it helps you keep rhythm with a physical Bible you read separately.

See `DECISIONS.md` for the project's decision log, including corrections
made to the reading-plan dataset and the rationale behind them.

## Status: Phase 4 — the writing system

Markdown notes are now real (sanitized rendering, not just raw text
storage), tags parse out of notes and reflections automatically per the
spec's exact grammar, and Daily/Monthly Reflections exist with their own
screen in Journal.

What's new since Phase 3:

- **`src/domain/markdown.ts`** — sanitized Markdown rendering (`marked` +
  `DOMPurify`), the one choke point every note/reflection display uses
- **`src/domain/tagParser.ts`** — `#tag` extraction per the spec's grammar,
  correctly excluding code spans, fenced code blocks, and link URLs
- **`src/services/tagRepo.ts`** — regenerates a source's tag index on save
- **`src/services/reflectionRepo.ts`** — Daily/Monthly Reflections, keyed
  by calendar date and month respectively, independent of plan ordinals
- **`src/routes/Journal.tsx`** — real UI for both reflection types
- Passage notes on the Reading Desk now render as Markdown when not being
  actively edited
- **23 new tests** — 77 total, all passing

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
