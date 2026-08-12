import db, { type PassageNoteRecord, type EncounterRecord } from "./database";
import type { ScriptureReference, StreamKey } from "../domain/types";
import { getPlanDay } from "../domain/datasetAdapter";
import { BIBLE_BOOK_ORDER, compareBookOrder } from "../domain/bibleBooks";

export interface ScriptureNoteEntry {
  note: PassageNoteRecord;
  encounter: EncounterRecord;
  reference: ScriptureReference;
  stream: StreamKey;
}

/**
 * Every passage note across all reading years, joined back to the
 * Scripture reference it belongs to (via its encounter's stream + ordinal)
 * and grouped by biblical book in canonical order — Genesis through
 * Revelation — matching both the archive's browsing order and the export
 * folder structure.
 */
export async function getScriptureNotesByBook(): Promise<
  { book: string; entries: ScriptureNoteEntry[] }[]
> {
  const notes = await db.passageNotes.toArray();
  const entries: ScriptureNoteEntry[] = [];

  for (const note of notes) {
    if (!note.markdown.trim()) continue; // an emptied-out note has nothing to archive
    const encounter = await db.encounters.get(note.encounterId);
    if (!encounter) continue; // orphaned note (shouldn't normally happen)
    const planDay = getPlanDay(encounter.ordinal);
    const reference = planDay?.streams[encounter.stream];
    if (!reference) continue;
    entries.push({ note, encounter, reference, stream: encounter.stream });
  }

  const byBook = new Map<string, ScriptureNoteEntry[]>();
  for (const entry of entries) {
    const list = byBook.get(entry.reference.book) ?? [];
    list.push(entry);
    byBook.set(entry.reference.book, list);
  }
  for (const list of byBook.values()) {
    list.sort((a, b) => a.encounter.ordinal - b.encounter.ordinal);
  }

  return BIBLE_BOOK_ORDER.filter((book) => byBook.has(book))
    .map((book) => ({ book, entries: byBook.get(book)! }))
    .sort((a, b) => compareBookOrder(a.book, b.book));
}
