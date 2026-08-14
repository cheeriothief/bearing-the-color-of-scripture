import { describe, it, expect, beforeEach } from "vitest";
import db from "../src/services/database";
import {
  toggleCompletion,
  findEncounter,
  savePassageNote,
  savePassageNoteForReading,
  getPassageNote,
} from "../src/services/encounterActions";
import { getOrCreateActiveReadingYear } from "../src/services/readingYearRepo";
import { FixedClock } from "../src/services/clock";
import {
  getStreamSessionAssignment,
  setStreamSession,
  streamsForSession,
  defaultSessionForTime,
} from "../src/services/settingsRepo";
import { shiftStream, listShiftEvents } from "../src/services/shiftEventRepo";

beforeEach(async () => {
  // Fresh database state for every test.
  await db.readingYears.clear();
  await db.streamShiftEvents.clear();
  await db.encounters.clear();
  await db.passageNotes.clear();
  await db.settings.clear();
});

describe("readingYearRepo", () => {
  it("creates exactly one reading year on first call, and reuses it thereafter", async () => {
    const clock = new FixedClock({ year: 2026, month: 9, day: 1 });
    const first = await getOrCreateActiveReadingYear(clock);
    const second = await getOrCreateActiveReadingYear(clock);
    expect(second.id).toBe(first.id);
    const all = await db.readingYears.toArray();
    expect(all).toHaveLength(1);
  });
});

describe("encounterActions — lazy creation", () => {
  it("does not create an encounter row just from checking for one", async () => {
    const found = await findEncounter("year-1", "psalms", 1);
    expect(found).toBeUndefined();
    const all = await db.encounters.toArray();
    expect(all).toHaveLength(0);
  });

  it("toggling completion creates the encounter row lazily, exactly once", async () => {
    await toggleCompletion("year-1", "psalms", 1);
    const all = await db.encounters.toArray();
    expect(all).toHaveLength(1);
    expect(all[0].completedAt).not.toBeNull();
  });

  it("toggling twice completes then un-completes, without creating a second row", async () => {
    await toggleCompletion("year-1", "psalms", 1);
    const result = await toggleCompletion("year-1", "psalms", 1);
    expect(result.completedAt).toBeNull();
    const all = await db.encounters.toArray();
    expect(all).toHaveLength(1);
  });
});

describe("encounterActions — passage notes", () => {
  it("does not create an encounter for an empty or whitespace-only note", async () => {
    expect(
      await savePassageNoteForReading("year-1", "psalms", 1, "  \n")
    ).toBeUndefined();
    expect(await db.encounters.count()).toBe(0);
    expect(await db.passageNotes.count()).toBe(0);
  });

  it("creates an encounter when meaningful note content is saved", async () => {
    const encounter = await savePassageNoteForReading(
      "year-1",
      "psalms",
      1,
      "Meaningful content"
    );

    expect(encounter).toBeDefined();
    expect(await db.encounters.count()).toBe(1);
    expect(await getPassageNote(encounter!.id)).toBe("Meaningful content");
  });

  it("a note is tied to one specific encounter, not the passage in general", async () => {
    const enc1 = await toggleCompletion("year-1", "gospel", 5); // Matthew 5, pass 1
    const enc2 = await toggleCompletion("year-1", "gospel", 200); // Matthew 5 again, later pass — different ordinal

    await savePassageNote(enc1.id, "First encounter with this passage.");
    await savePassageNote(enc2.id, "Second encounter — different reflection.");

    expect(await getPassageNote(enc1.id)).toBe("First encounter with this passage.");
    expect(await getPassageNote(enc2.id)).toBe("Second encounter — different reflection.");
  });

  it("saving a note twice updates it in place rather than duplicating", async () => {
    const enc = await toggleCompletion("year-1", "psalms", 1);
    await savePassageNote(enc.id, "draft one");
    await savePassageNote(enc.id, "draft two");
    expect(await getPassageNote(enc.id)).toBe("draft two");
    const all = await db.passageNotes.toArray();
    expect(all).toHaveLength(1);
  });
});

describe("settingsRepo", () => {
  it("returns sensible defaults before any preference is set", async () => {
    const assignment = await getStreamSessionAssignment();
    expect(assignment.psalms).toBeDefined();
    expect(streamsForSession(assignment, "morning").length).toBeGreaterThan(0);
  });

  it("persists a manual reassignment", async () => {
    await setStreamSession("psalms", "evening");
    const assignment = await getStreamSessionAssignment();
    expect(assignment.psalms).toBe("evening");
  });

  it("defaultSessionForTime splits on the hour", () => {
    expect(defaultSessionForTime(new Date(2026, 0, 1, 8, 0))).toBe("morning");
    expect(defaultSessionForTime(new Date(2026, 0, 1, 20, 0))).toBe("evening");
  });
});

describe("shiftEventRepo", () => {
  it("records a shift event scoped to one stream and one reading year", async () => {
    await shiftStream("year-1", "oldTestament", 10, 1);
    const events = await listShiftEvents("year-1");
    expect(events).toHaveLength(1);
    expect(events[0].stream).toBe("oldTestament");
    expect(events[0].startingOrdinal).toBe(10);
    expect(events[0].delayDays).toBe(1);
  });

  it("does not return shift events belonging to a different reading year", async () => {
    await shiftStream("year-1", "oldTestament", 10, 1);
    await shiftStream("year-2", "gospel", 3, 1);
    const events = await listShiftEvents("year-1");
    expect(events).toHaveLength(1);
    expect(events[0].readingYearId).toBe("year-1");
  });
});
