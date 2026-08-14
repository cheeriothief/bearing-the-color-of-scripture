import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import { createAppDatabase, type EncounterRecord } from "../src/services/database";

const LEGACY_STORES = {
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

const databaseNames: string[] = [];
const timestamp = "2026-09-01T12:00:00.000Z";

function uniqueDatabaseName(): string {
  const name = `encounter-migration-${crypto.randomUUID()}`;
  databaseNames.push(name);
  return name;
}

async function createLegacyDatabase(name: string): Promise<Dexie> {
  const legacy = new Dexie(name);
  legacy.version(1).stores(LEGACY_STORES);
  await legacy.open();
  return legacy;
}

function encounter(
  id: string,
  overrides: Partial<EncounterRecord> = {}
): EncounterRecord {
  return {
    id,
    readingYearId: "year-1",
    stream: "psalms",
    ordinal: 1,
    completedAt: null,
    createdAt: timestamp,
    ...overrides,
  };
}

afterEach(async () => {
  await Promise.all(databaseNames.splice(0).map((name) => Dexie.delete(name)));
});

describe("encounter unique-index migration", () => {
  it("upgrades a valid version 1 database without losing data or relationships", async () => {
    const name = uniqueDatabaseName();
    const legacy = await createLegacyDatabase(name);
    await legacy.table("readingYears").add({
      id: "year-1",
      startDate: { year: 2026, month: 9, day: 1 },
      createdAt: timestamp,
    });
    await legacy.table("encounters").add(encounter("encounter-1", { completedAt: timestamp }));
    await legacy.table("passageNotes").add({
      id: "note-1", encounterId: "encounter-1", markdown: "Preserved note", createdAt: timestamp, updatedAt: timestamp,
    });
    await legacy.table("dailyReflections").add({
      id: "daily-1", date: "2026-09-01", markdown: "Preserved reflection", createdAt: timestamp, updatedAt: timestamp,
    });
    await legacy.table("settings").add({ key: "theme", value: "minimal" });
    legacy.close();

    const upgraded = createAppDatabase(name);
    await upgraded.open();

    expect(await upgraded.readingYears.get("year-1")).toBeDefined();
    expect(await upgraded.encounters.get("encounter-1")).toMatchObject({ completedAt: timestamp });
    expect(await upgraded.passageNotes.get("note-1")).toMatchObject({ encounterId: "encounter-1", markdown: "Preserved note" });
    expect(await upgraded.dailyReflections.get("daily-1")).toMatchObject({ markdown: "Preserved reflection" });
    expect(await upgraded.settings.get("theme")).toMatchObject({ value: "minimal" });
    upgraded.close();
  });

  it("merges duplicate encounters deterministically while preserving completion, note, and tags", async () => {
    const name = uniqueDatabaseName();
    const legacy = await createLegacyDatabase(name);
    await legacy.table("encounters").bulkAdd([
      encounter("oldest", { createdAt: "2026-09-01T10:00:00.000Z" }),
      encounter("completed", { createdAt: "2026-09-01T11:00:00.000Z", completedAt: timestamp }),
    ]);
    await legacy.table("passageNotes").add({
      id: "note-1", encounterId: "completed", markdown: "Authored #hope", createdAt: timestamp, updatedAt: timestamp,
    });
    await legacy.table("tagReferences").add({
      id: "tag-1", tag: "hope", sourceType: "passageNote", sourceId: "note-1", createdAt: timestamp,
    });
    legacy.close();

    const upgraded = createAppDatabase(name);
    await upgraded.open();

    expect(await upgraded.encounters.toArray()).toEqual([
      encounter("oldest", { createdAt: "2026-09-01T10:00:00.000Z", completedAt: timestamp }),
    ]);
    expect(await upgraded.passageNotes.get("note-1")).toMatchObject({ encounterId: "oldest", markdown: "Authored #hope" });
    expect(await upgraded.tagReferences.get("tag-1")).toMatchObject({ sourceId: "note-1", tag: "hope" });
    await expect(upgraded.encounters.add(encounter("duplicate-after-upgrade"))).rejects.toMatchObject({ name: "ConstraintError" });
    upgraded.close();
  });

  it("deduplicates identical note copies without losing their authored content", async () => {
    const name = uniqueDatabaseName();
    const legacy = await createLegacyDatabase(name);
    await legacy.table("encounters").bulkAdd([
      encounter("first", { createdAt: "2026-09-01T10:00:00.000Z" }),
      encounter("second", { createdAt: "2026-09-01T11:00:00.000Z" }),
    ]);
    await legacy.table("passageNotes").bulkAdd([
      { id: "note-first", encounterId: "first", markdown: "Same authored text", createdAt: timestamp, updatedAt: timestamp },
      { id: "note-second", encounterId: "second", markdown: "Same authored text", createdAt: timestamp, updatedAt: timestamp },
    ]);
    legacy.close();

    const upgraded = createAppDatabase(name);
    await upgraded.open();
    const notes = await upgraded.passageNotes.toArray();

    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ encounterId: "first", markdown: "Same authored text" });
    upgraded.close();
  });

  it("aborts safely when duplicate encounters contain conflicting authored notes", async () => {
    const name = uniqueDatabaseName();
    const legacy = await createLegacyDatabase(name);
    await legacy.table("encounters").bulkAdd([encounter("first"), encounter("second")]);
    await legacy.table("passageNotes").bulkAdd([
      { id: "note-first", encounterId: "first", markdown: "First unique thought", createdAt: timestamp, updatedAt: timestamp },
      { id: "note-second", encounterId: "second", markdown: "Second unique thought", createdAt: timestamp, updatedAt: timestamp },
    ]);
    legacy.close();

    const upgraded = createAppDatabase(name);
    await expect(upgraded.open()).rejects.toThrow(/conflicting passage notes require manual recovery/);
    upgraded.close();

    const unchanged = await createLegacyDatabase(name);
    expect(await unchanged.table("encounters").count()).toBe(2);
    expect((await unchanged.table("passageNotes").toArray()).map((note) => note.markdown).sort()).toEqual([
      "First unique thought",
      "Second unique thought",
    ]);
    unchanged.close();
  });
});
