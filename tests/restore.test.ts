import { describe, it, expect, beforeEach } from "vitest";
import db from "../src/services/database";
import {
  buildJsonBackup,
  parseJsonBackup,
  restoreFromJsonBackup,
  InvalidBackupError,
} from "../src/services/exportService";
import { toggleCompletion, savePassageNote } from "../src/services/encounterActions";
import { saveDailyReflection } from "../src/services/reflectionRepo";
import { setTheme, getTheme } from "../src/services/settingsRepo";
import { markThresholdShown, getLastThresholdDate } from "../src/services/appStateRepo";
import type { LocalDate } from "../src/services/clock";

const sep1: LocalDate = { year: 2026, month: 9, day: 1 };

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
  it("rejects text that isn't JSON at all", () => {
    expect(() => parseJsonBackup("not json{{{")).toThrow(InvalidBackupError);
  });

  it("rejects JSON that isn't an object", () => {
    expect(() => parseJsonBackup("[1,2,3]")).toThrow(InvalidBackupError);
    expect(() => parseJsonBackup('"just a string"')).toThrow(InvalidBackupError);
  });

  it("rejects an unrecognized backup version", () => {
    const bad = JSON.stringify({ backupVersion: 99, encounters: [] });
    expect(() => parseJsonBackup(bad)).toThrow(InvalidBackupError);
  });

  it("rejects a backup missing a required table section", () => {
    const bad = JSON.stringify({ backupVersion: 1, readingYears: [] }); // missing everything else
    expect(() => parseJsonBackup(bad)).toThrow(InvalidBackupError);
  });

  it("accepts a well-formed, fully-empty backup", () => {
    const empty = JSON.stringify({
      backupVersion: 1,
      exportedAt: new Date().toISOString(),
      readingYears: [],
      streamShiftEvents: [],
      encounters: [],
      passageNotes: [],
      dailyReflections: [],
      monthlyReflections: [],
      tagReferences: [],
      settings: [],
      appState: [],
    });
    expect(() => parseJsonBackup(empty)).not.toThrow();
  });
});

describe("restoreFromJsonBackup — full round trip", () => {
  it("restores every table's contents exactly after a build -> clear -> restore cycle", async () => {
    // Populate real data across every table the backup covers.
    const enc = await toggleCompletion("year-1", "gospel", 1);
    await savePassageNote(enc.id, "A note with a #tag.");
    await saveDailyReflection(sep1, "Reflecting today with #gratitude.");
    await setTheme("candlelight");
    await markThresholdShown("2026-09-01");

    const backup = await buildJsonBackup();

    // Wipe everything, simulating a fresh device.
    await db.readingYears.clear();
    await db.streamShiftEvents.clear();
    await db.encounters.clear();
    await db.passageNotes.clear();
    await db.dailyReflections.clear();
    await db.monthlyReflections.clear();
    await db.tagReferences.clear();
    await db.settings.clear();
    await db.appState.clear();

    await restoreFromJsonBackup(backup);

    const encounters = await db.encounters.toArray();
    expect(encounters).toHaveLength(1);
    expect(encounters[0].completedAt).not.toBeNull();

    const notes = await db.passageNotes.toArray();
    expect(notes[0].markdown).toBe("A note with a #tag.");

    const tags = await db.tagReferences.toArray();
    expect(tags.map((t) => t.tag).sort()).toEqual(["gratitude", "tag"]);

    expect(await getTheme()).toBe("candlelight");
    expect(await getLastThresholdDate()).toBe("2026-09-01");
  });

  it("REPLACES existing state rather than merging with it", async () => {
    // Old data on the device before restore.
    await toggleCompletion("old-year", "psalms", 1);
    const backup = await buildJsonBackup(); // backup of a totally different state

    // New data arrives via a backup that was built from an empty database.
    await db.encounters.clear();
    const enc = await toggleCompletion("new-year", "gospel", 5);
    const emptyBackup = JSON.stringify({
      backupVersion: 1,
      exportedAt: new Date().toISOString(),
      readingYears: [],
      streamShiftEvents: [],
      encounters: [],
      passageNotes: [],
      dailyReflections: [],
      monthlyReflections: [],
      tagReferences: [],
      settings: [],
      appState: [],
    });
    void backup;
    void enc;

    await restoreFromJsonBackup(emptyBackup);

    // Restoring an empty backup should leave the database empty, not
    // preserve the "new-year" encounter that existed before restoring.
    const encounters = await db.encounters.toArray();
    expect(encounters).toHaveLength(0);
  });

  it("does not touch the database at all when the backup is invalid", async () => {
    await toggleCompletion("year-1", "psalms", 1);
    const before = await db.encounters.toArray();
    expect(before).toHaveLength(1);

    await expect(restoreFromJsonBackup("garbage not json")).rejects.toThrow(InvalidBackupError);

    const after = await db.encounters.toArray();
    expect(after).toHaveLength(1); // untouched
    expect(after[0].id).toBe(before[0].id);
  });

  it("preserves original ids, ordinals, and timestamps exactly rather than regenerating them", async () => {
    const enc = await toggleCompletion("year-1", "gospel", 42);
    const backup = await buildJsonBackup();
    await db.encounters.clear();
    await restoreFromJsonBackup(backup);

    const restored = await db.encounters.toArray();
    expect(restored[0].id).toBe(enc.id);
    expect(restored[0].ordinal).toBe(42);
    expect(restored[0].completedAt).toBe(enc.completedAt);
  });
});
