import Dexie, { type EntityTable } from "dexie";
import type { ReadingYear, StreamShiftEvent, StreamKey } from "../domain/types";

/**
 * A user's completion/note state for one specific reading encounter — i.e.
 * one occurrence of one stream's ordinal within one reading year.
 *
 * Encounter rows are created LAZILY: the app never pre-generates rows for
 * all ~1,825 possible encounters on onboarding. A row for a given
 * (readingYearId, stream, ordinal) is only created the first time the user
 * completes that reading or writes a note on it. Until then, "not yet
 * encountered" is represented by the absence of a row, not a row with
 * default/empty fields.
 */
export interface EncounterRecord {
  id: string;
  readingYearId: string;
  stream: StreamKey;
  ordinal: number;
  completedAt: string | null;
  createdAt: string;
}

/**
 * A passage note tied to one specific encounter. Because encounters are
 * per-occurrence (not per-passage), re-reading Matthew 5 later in the year
 * gets its own note rather than overwriting this one.
 */
export interface PassageNoteRecord {
  id: string;
  encounterId: string;
  markdown: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailyReflectionRecord {
  id: string;
  /** ISO calendar date (YYYY-MM-DD), device-local. Keyed by date, not plan ordinal. */
  date: string;
  markdown: string;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyReflectionRecord {
  id: string;
  /** "YYYY-MM" */
  month: string;
  markdown: string;
  createdAt: string;
  updatedAt: string;
}

/** Regenerable index of #tags found in notes/reflections, for fast browsing. */
export interface TagReferenceRecord {
  id: string;
  tag: string;
  sourceType: "passageNote" | "dailyReflection" | "monthlyReflection";
  sourceId: string;
  createdAt: string;
}

export interface SettingRecord {
  key: string;
  value: unknown;
}

export interface AppStateRecord {
  key: string;
  value: unknown;
}

const db = new Dexie("BearingTheColorOfScripture") as Dexie & {
  readingYears: EntityTable<ReadingYear, "id">;
  streamShiftEvents: EntityTable<StreamShiftEvent, "id">;
  encounters: EntityTable<EncounterRecord, "id">;
  passageNotes: EntityTable<PassageNoteRecord, "id">;
  dailyReflections: EntityTable<DailyReflectionRecord, "id">;
  monthlyReflections: EntityTable<MonthlyReflectionRecord, "id">;
  tagReferences: EntityTable<TagReferenceRecord, "id">;
  settings: EntityTable<SettingRecord, "key">;
  appState: EntityTable<AppStateRecord, "key">;
};

// Version 1 schema. Only fields that need indexing are listed after the
// primary key — Dexie doesn't require every field to be declared.
db.version(1).stores({
  readingYears: "id, startDate, createdAt",
  streamShiftEvents: "id, readingYearId, stream, startingOrdinal",
  encounters: "id, readingYearId, stream, ordinal, [readingYearId+stream+ordinal]",
  passageNotes: "id, encounterId",
  dailyReflections: "id, date",
  monthlyReflections: "id, month",
  tagReferences: "id, tag, sourceType, sourceId",
  settings: "key",
  appState: "key",
});

export default db;

/**
 * Find an existing encounter for this (year, stream, ordinal), or create it
 * lazily if it doesn't exist yet. This is the ONLY place encounter rows get
 * created — call it when the user completes a reading or starts a note, not
 * proactively.
 */
export async function getOrCreateEncounter(
  readingYearId: string,
  stream: StreamKey,
  ordinal: number
): Promise<EncounterRecord> {
  const existing = await db.encounters
    .where("[readingYearId+stream+ordinal]")
    .equals([readingYearId, stream, ordinal])
    .first();
  if (existing) return existing;

  const record: EncounterRecord = {
    id: crypto.randomUUID(),
    readingYearId,
    stream,
    ordinal,
    completedAt: null,
    createdAt: new Date().toISOString(),
  };
  await db.encounters.add(record);
  return record;
}
