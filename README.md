# Bearing the Color of Scripture

A tablet-first, local-first Bible reading companion. The app is the narthex;
the physical Bible is the sanctuary — this app never contains Scripture
itself, it helps you keep rhythm with a physical Bible you read separately.

See `DECISIONS.md` for the project's decision log, including corrections
made to the reading-plan dataset and the rationale behind them.

## Status: Phase 2 — first usable milestone

The Reading Desk is real and working: today's five readings resolve correctly,
split into Morning/Evening sessions, a reading can be marked complete, a
passage note can be written and saved, everything works fully offline, and
one stream can be shifted independently of the other four. This is the
spec's own defined "first internal usable milestone" — ugly, unstyled, but
real. The visual design (swipe gestures, two-pane tablet layout, previous-
encounter indicators, Markdown rendering) is Phase 3+.

What's new since Phase 1:

- **`src/routes/Read.tsx`** — the actual Reading Desk screen: resolves
  today's readings, lets you switch sessions, mark things complete, shift a
  stream, and write/save a passage note
- **`src/services/readingYearRepo.ts`** — bootstraps a reading year on first
  launch (see `DECISIONS.md` for why it starts today rather than the spec's
  default September 1 — this is a Phase 2 shortcut, not a spec change)
- **`src/services/settingsRepo.ts`** — persisted per-stream Morning/Evening
  assignment
- **`src/services/shiftEventRepo.ts`** — records Shift Stream decisions
- **`src/services/encounterActions.ts`** — completion toggling and passage
  notes, both backed by lazy encounter creation
- **13 new tests** (repository behavior + a component-level smoke test that
  renders the real Reading Desk against an in-memory IndexedDB and confirms
  completion actually persists) — 37 total, all passing

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
