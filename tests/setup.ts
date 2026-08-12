// Installs an in-memory IndexedDB implementation so Dexie works under
// jsdom/vitest, where no real browser IndexedDB exists.
import "fake-indexeddb/auto";
import "@testing-library/jest-dom/vitest";
