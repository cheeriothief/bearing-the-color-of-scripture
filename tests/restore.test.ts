import { describe, it, expect, beforeEach } from "vitest";
import db from "../src/services/database";
import {
  buildJsonBackup,
  parseJsonBackup,
  restoreFromJsonBackup,
  InvalidBackupError,
} from "../src/services/exportService";
import { loadDataset } from "../src/domain/datasetAdapter";
import { toggleCompletion, savePassageNote } from "../src/services/encounterActions";
import { saveDailyReflection } from "../src/services/reflectionRepo";
import { setTheme, getTheme } from "../src/services/settingsRepo";
import { markThresholdShown, getLastThresholdDate } from "../src/services/appStateRepo";
import type { LocalDate } from "../src/services/clock";

const sep1: LocalDate = { year: 2026, month: 9, day: 1 };
const timestamp = "2026-09-01T12:00:00.000Z";

function emptyBackup() {
  return {
    backupVersion: 1,
    exportedAt: timestamp,
    readingPlanDatasetVersion: loadDataset().datasetVersion,
    readingYears: [] as unknown[],
    streamShiftEvents: [] as unknown[],
    encounters: [] as unknown[],
    passageNotes: [] as unknown[],
    dailyReflections: [] as unknown[],
    monthlyReflections: [] as unknown[],
    tagReferences: [] as unknown[],
    settings: [] as unknown[],
    appState: [] as unknown[],
  };
}

function readingYear(id = "year-1") {
  return { id, startDate: sep1, createdAt: timestamp };
}

function encounter(id = "encounter-1", readingYearId = "year-1") {
  return {
    id,
    readingYearId,
    stream: "gospel",
    ordinal: 1,
    completedAt: timestamp,
    createdAt: timestamp,
  };
}

async function addReadingYear(id = "year-1"): Promise<void> {
  await db.readingYears.add(readingYear(id));
}

beforeEach(async () => {
  await db.readingYears.clear();
  await db.streamShiftEvents.clear();
  await db.encounters.clear();
  await db.passageNotes.clear();
  await db.dailyReflections.clear();
  await db.monthlyReflections.clear();
  await db.tagReferences.clear();
  await db.settings.clear();
  await db.appState.clear();
});

describe("parseJsonBackup — validation", () => {
  it("rejects text that isn't JSON or an object", () => {
    expect(() => parseJsonBackup("not json{{{")).toThrow(InvalidBackupError);
    expect(() => parseJsonBackup("[1,2,3]")).toThrow(/backup: must be an object/);
  });

  it("rejects an unrecognized backup version or a missing table", () => {
    expect(() => parseJsonBackup(JSON.stringify({ ...emptyBackup(), backupVersion: 99 }))).toThrow(
      /backupVersion/
    );
    const missing = emptyBackup() as Record<string, unknown>;
    delete missing.settings;
    expect(() => parseJsonBackup(JSON.stringify(missing))).toThrow(/backup.settings/);
  });

  it("accepts a well-formed current backup", () => {
    expect(() => parseJsonBackup(JSON.stringify(emptyBackup()))).not.toThrow();
  });

  it("rejects an invalid record field type", () => {
    const backup = emptyBackup();
    backup.readingYears.push({ ...readingYear(), createdAt: 123 });
    expect(() => parseJsonBackup(JSON.stringify(backup))).toThrow(/readingYears\[0\]\.createdAt/);
  });

  it("rejects an invalid stream identifier", () => {
    const backup = emptyBackup();
    backup.readingYears.push(readingYear());
    backup.encounters.push({ ...encounter(), stream: "apocrypha" });
    expect(() => parseJsonBackup(JSON.stringify(backup))).toThrow(/invalid stream/);
  });

  it("rejects an invalid ordinal", () => {
    const backup = emptyBackup();
    backup.readingYears.push(readingYear());
    backup.encounters.push({ ...encounter(), ordinal: 366 });
    expect(() => parseJsonBackup(JSON.stringify(backup))).toThrow(/must be between 1 and 365/);
  });

  it("rejects invalid calendar dates and reading-year start dates", () => {
    const invalidYear = emptyBackup();
    invalidYear.readingYears.push({ ...readingYear(), startDate: { year: 2026, month: 2, day: 30 } });
    expect(() => parseJsonBackup(JSON.stringify(invalidYear))).toThrow(/startDate.day/);

    const invalidReflection = emptyBackup();
    invalidReflection.dailyReflections.push({
      id: "daily-1", date: "2026-02-30", markdown: "note", createdAt: timestamp, updatedAt: timestamp,
    });
    expect(() => parseJsonBackup(JSON.stringify(invalidReflection))).toThrow(/dailyReflections\[0\]\.date/);
  });

  it("rejects an encounter referencing a nonexistent reading year", () => {
    const backup = emptyBackup();
    backup.encounters.push(encounter());
    expect(() => parseJsonBackup(JSON.stringify(backup))).toThrow(/references missing reading year/);
  });

  it("rejects a passage note referencing a nonexistent encounter", () => {
    const backup = emptyBackup();
    backup.passageNotes.push({
      id: "note-1", encounterId: "missing", markdown: "note", createdAt: timestamp, updatedAt: timestamp,
    });
    expect(() => parseJsonBackup(JSON.stringify(backup))).toThrow(/references missing encounter/);
  });

  it("rejects duplicate logical encounters", () => {
    const backup = emptyBackup();
    backup.readingYears.push(readingYear());
    backup.encounters.push(encounter("encounter-1"), encounter("encounter-2"));
    expect(() => parseJsonBackup(JSON.stringify(backup))).toThrow(/reading year\/stream\/ordinal/);
  });

  it("rejects duplicate logical daily reflections", () => {
    const backup = emptyBackup();
    backup.dailyReflections.push(
      { id: "daily-1", date: "2026-09-01", markdown: "one", createdAt: timestamp, updatedAt: timestamp },
      { id: "daily-2", date: "2026-09-01", markdown: "two", createdAt: timestamp, updatedAt: timestamp }
    );
    expect(() => parseJsonBackup(JSON.stringify(backup))).toThrow(/daily reflection date/);
  });

  it("rejects duplicate logical monthly reflections", () => {
    const backup = emptyBackup();
    backup.monthlyReflections.push(
      { id: "monthly-1", month: "2026-09", markdown: "one", createdAt: timestamp, updatedAt: timestamp },
      { id: "monthly-2", month: "2026-09", markdown: "two", createdAt: timestamp, updatedAt: timestamp }
    );
    expect(() => parseJsonBackup(JSON.stringify(backup))).toThrow(/monthly reflection month/);
  });

  it("rejects an incompatible reading-plan dataset version", () => {
    const backup = { ...emptyBackup(), readingPlanDatasetVersion: "incompatible-version" };
    expect(() => parseJsonBackup(JSON.stringify(backup))).toThrow(/this app requires/);
  });

  it("accepts legacy backups without dataset data, but rejects legacy ordinals", () => {
    const safeLegacy = emptyBackup() as Record<string, unknown>;
    delete safeLegacy.readingPlanDatasetVersion;
    expect(() => parseJsonBackup(JSON.stringify(safeLegacy))).not.toThrow();

    const unsafeLegacy = emptyBackup() as Record<string, unknown>;
    delete unsafeLegacy.readingPlanDatasetVersion;
    unsafeLegacy.readingYears = [readingYear()];
    unsafeLegacy.encounters = [encounter()];
    expect(() => parseJsonBackup(JSON.stringify(unsafeLegacy))).toThrow(/legacy backup/);
  });
});

describe("restoreFromJsonBackup — validated atomic replacement", () => {
  it("round-trips a valid current backup without losing application data", async () => {
    await addReadingYear();
    const enc = await toggleCompletion("year-1", "gospel", 1);
    await savePassageNote(enc.id, "A note with a #tag.");
    await saveDailyReflection(sep1, "Reflecting today with #gratitude.");
    await setTheme("candlelight");
    await markThresholdShown("2026-09-01");

    const backup = await buildJsonBackup();
    expect(JSON.parse(backup).readingPlanDatasetVersion).toBe(loadDataset().datasetVersion);
    const before = JSON.parse(backup);

    await Promise.all([
      db.readingYears.clear(), db.encounters.clear(), db.passageNotes.clear(),
      db.dailyReflections.clear(), db.tagReferences.clear(), db.settings.clear(), db.appState.clear(),
    ]);
    await restoreFromJsonBackup(backup);

    expect(await db.readingYears.toArray()).toEqual(before.readingYears);
    expect(await db.encounters.toArray()).toEqual(before.encounters);
    expect(await db.passageNotes.toArray()).toEqual(before.passageNotes);
    expect((await db.tagReferences.toArray()).map((tag) => tag.tag).sort()).toEqual(["gratitude", "tag"]);
    expect(await getTheme()).toBe("candlelight");
    expect(await getLastThresholdDate()).toBe("2026-09-01");
  });

  it("replaces existing state rather than merging with it", async () => {
    await addReadingYear();
    await toggleCompletion("year-1", "psalms", 1);
    await restoreFromJsonBackup(JSON.stringify(emptyBackup()));
    expect(await db.readingYears.count()).toBe(0);
    expect(await db.encounters.count()).toBe(0);
  });

  it("rejected backups leave all existing data unchanged and never partially replace it", async () => {
    await addReadingYear();
    await toggleCompletion("year-1", "psalms", 1);
    await saveDailyReflection(sep1, "Existing reflection");
    await setTheme("minimal");
    const before = await buildJsonBackup();

    const invalid = emptyBackup();
    invalid.readingYears.push(readingYear("replacement-year"));
    invalid.settings.push({ key: "theme", value: "invalid-theme" });
    await expect(restoreFromJsonBackup(JSON.stringify(invalid))).rejects.toThrow(InvalidBackupError);

    const after = JSON.parse(await buildJsonBackup());
    const original = JSON.parse(before);
    delete after.exportedAt;
    delete original.exportedAt;
    expect(after).toEqual(original);
  });

  it("preserves original ids, ordinals, and timestamps", async () => {
    await addReadingYear();
    const enc = await toggleCompletion("year-1", "gospel", 42);
    const backup = await buildJsonBackup();
    await db.encounters.clear();
    await db.readingYears.clear();
    await restoreFromJsonBackup(backup);
    expect((await db.encounters.toArray())[0]).toEqual(enc);
  });
});
