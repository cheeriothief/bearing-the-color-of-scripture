import Dexie, { type EntityTable, type Transaction } from "dexie";
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

export type AppDatabase = Dexie & {
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

const VERSION_1_STORES = {
  readingYears: "id, startDate, createdAt",
  streamShiftEvents: "id, readingYearId, stream, startingOrdinal",
  encounters: "id, readingYearId, stream, ordinal, [readingYearId+stream+ordinal]",
  passageNotes: "id, encounterId",
  dailyReflections: "id, date",
  monthlyReflections: "id, month",
  tagReferences: "id, tag, sourceType, sourceId",
  settings: "key",
  appState: "key",
};

const VERSION_3_STORES = {
  ...VERSION_1_STORES,
  encounters: "id, readingYearId, stream, ordinal, &[readingYearId+stream+ordinal]",
};

function compareCreatedThenId(
  a: { createdAt: string; id: string },
  b: { createdAt: string; id: string }
): number {
  return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

/**
 * Version 1 allowed duplicate logical encounters. Reconcile them before the
 * following schema version creates the unique compound index. The oldest
 * encounter id survives, completion is preserved if any duplicate was
 * complete, and notes/tags are repointed to it. Distinct non-empty note text
 * is never guessed at or discarded: the upgrade aborts atomically instead.
 */
async function reconcileDuplicateEncounters(transaction: Transaction): Promise<void> {
  const encounters = transaction.table<EncounterRecord, string>("encounters");
  const passageNotes = transaction.table<PassageNoteRecord, string>("passageNotes");
  const tagReferences = transaction.table<TagReferenceRecord, string>("tagReferences");
  const groups = new Map<string, EncounterRecord[]>();

  for (const encounter of await encounters.toArray()) {
    const key = `${encounter.readingYearId}\u0000${encounter.stream}\u0000${encounter.ordinal}`;
    const group = groups.get(key) ?? [];
    group.push(encounter);
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    if (group.length < 2) continue;
    group.sort(compareCreatedThenId);
    const survivor = group[0];
    const duplicateIds = new Set(group.map(({ id }) => id));
    const completedAt = group
      .map((encounter) => encounter.completedAt)
      .filter((value): value is string => value !== null)
      .sort()[0] ?? null;
    if (survivor.completedAt !== completedAt) {
      await encounters.update(survivor.id, { completedAt });
    }

    const notes = (await passageNotes.toArray())
      .filter((note) => duplicateIds.has(note.encounterId))
      .sort(compareCreatedThenId);
    const distinctAuthoredContent = new Set(
      notes.map((note) => note.markdown).filter((markdown) => markdown.trim())
    );
    if (distinctAuthoredContent.size > 1) {
      throw new Error(
        `Cannot safely merge duplicate encounters for ${survivor.readingYearId}/${survivor.stream}/${survivor.ordinal}: conflicting passage notes require manual recovery.`
      );
    }

    const authoredMarkdown = distinctAuthoredContent.values().next().value as string | undefined;
    const keeper = notes.find((note) => authoredMarkdown !== undefined && note.markdown === authoredMarkdown)
      ?? notes[0];
    if (keeper) {
      if (keeper.encounterId !== survivor.id) {
        await passageNotes.update(keeper.id, { encounterId: survivor.id });
      }
      const noteIds = new Set(notes.map(({ id }) => id));
      const tags = (await tagReferences.toArray())
        .filter((tag) => tag.sourceType === "passageNote" && noteIds.has(tag.sourceId))
        .sort(compareCreatedThenId);
      const keptTags = new Map<string, TagReferenceRecord>();
      for (const tag of tags) {
        const prior = keptTags.get(tag.tag);
        if (prior) {
          await tagReferences.delete(tag.id);
        } else {
          keptTags.set(tag.tag, tag);
          if (tag.sourceId !== keeper.id) await tagReferences.update(tag.id, { sourceId: keeper.id });
        }
      }
      await passageNotes.bulkDelete(notes.filter((note) => note.id !== keeper.id).map(({ id }) => id));
    }

    await encounters.bulkDelete(group.slice(1).map(({ id }) => id));
  }
}

export function createAppDatabase(name = "BearingTheColorOfScripture"): AppDatabase {
  const database = new Dexie(name) as AppDatabase;
  database.version(1).stores(VERSION_1_STORES);
  // Version 2 removes legacy duplicates while the compound index is still
  // non-unique. Version 3 can then add the unique index without upgrade-time
  // ConstraintErrors from pre-existing data.
  database.version(2).stores(VERSION_1_STORES).upgrade(reconcileDuplicateEncounters);
  database.version(3).stores(VERSION_3_STORES);
  return database;
}

const db = createAppDatabase();

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
  return db.transaction("rw", db.encounters, async () => {
    const logicalKey: [string, StreamKey, number] = [readingYearId, stream, ordinal];
    const existing = await db.encounters
      .where("[readingYearId+stream+ordinal]")
      .equals(logicalKey)
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
    try {
      await db.encounters.add(record);
      return record;
    } catch (error) {
      if (!(error instanceof Dexie.ConstraintError)) throw error;
      const winner = await db.encounters
        .where("[readingYearId+stream+ordinal]")
        .equals(logicalKey)
        .first();
      if (!winner) throw error;
      return winner;
    }
  });
}
