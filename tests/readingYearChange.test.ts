import { describe, it, expect, beforeEach } from "vitest";
import db from "../src/services/database";
import {
  getOrCreateActiveReadingYear,
  hasActivity,
  changeStartDate,
} from "../src/services/readingYearRepo";
import { getActiveReadingYearId } from "../src/services/appStateRepo";
import { toggleCompletion } from "../src/services/encounterActions";
import { shiftStream } from "../src/services/shiftEventRepo";
import { FixedClock } from "../src/services/clock";
import type { LocalDate } from "../src/services/clock";

const sep1: LocalDate = { year: 2026, month: 9, day: 1 };
const oct1: LocalDate = { year: 2026, month: 10, day: 1 };

beforeEach(async () => {
  await db.readingYears.clear();
  await db.streamShiftEvents.clear();
  await db.encounters.clear();
  await db.appState.clear();
});

describe("hasActivity", () => {
  it("is false for a fresh reading year with nothing recorded", async () => {
    const clock = new FixedClock(sep1);
    const year = await getOrCreateActiveReadingYear(clock);
    expect(await hasActivity(year.id)).toBe(false);
  });

  it("becomes true after a completion", async () => {
    const clock = new FixedClock(sep1);
    const year = await getOrCreateActiveReadingYear(clock);
    await toggleCompletion(year.id, "psalms", 1);
    expect(await hasActivity(year.id)).toBe(true);
  });

  it("becomes true after a stream shift, even with no completions", async () => {
    const clock = new FixedClock(sep1);
    const year = await getOrCreateActiveReadingYear(clock);
    await shiftStream(year.id, "oldTestament", 5, 1);
    expect(await hasActivity(year.id)).toBe(true);
  });

  it("is unaffected by activity belonging to a different reading year", async () => {
    const clock = new FixedClock(sep1);
    const yearA = await getOrCreateActiveReadingYear(clock);
    await toggleCompletion("some-other-year-id", "psalms", 1);
    expect(await hasActivity(yearA.id)).toBe(false);
  });
});

describe("changeStartDate — before any activity", () => {
  it("updates the existing reading year in place rather than creating a new one", async () => {
    const clock = new FixedClock(sep1);
    const original = await getOrCreateActiveReadingYear(clock);

    const result = await changeStartDate(original, oct1);

    expect(result.kind).toBe("updated");
    expect(result.readingYear.id).toBe(original.id); // same reading year, not a new one
    expect(result.readingYear.startDate).toEqual(oct1);

    const allYears = await db.readingYears.toArray();
    expect(allYears).toHaveLength(1); // no duplicate created
  });

  it("the changed start date is what getOrCreateActiveReadingYear returns afterward", async () => {
    const clock = new FixedClock(sep1);
    const original = await getOrCreateActiveReadingYear(clock);
    await changeStartDate(original, oct1);

    const fetched = await getOrCreateActiveReadingYear(clock);
    expect(fetched.startDate).toEqual(oct1);
    expect(fetched.id).toBe(original.id);
  });
});

describe("changeStartDate — after activity exists", () => {
  it("creates a brand new reading year instead of mutating the old one", async () => {
    const clock = new FixedClock(sep1);
    const original = await getOrCreateActiveReadingYear(clock);
    await toggleCompletion(original.id, "psalms", 1); // meaningful activity

    const result = await changeStartDate(original, oct1);

    expect(result.kind).toBe("created");
    if (result.kind === "created") {
      expect(result.readingYear.id).not.toBe(original.id);
      expect(result.readingYear.startDate).toEqual(oct1);
      expect(result.previousReadingYear.id).toBe(original.id);
    }

    const allYears = await db.readingYears.toArray();
    expect(allYears).toHaveLength(2); // old one preserved, new one added
  });

  it("preserves the original reading year's start date and data untouched", async () => {
    const clock = new FixedClock(sep1);
    const original = await getOrCreateActiveReadingYear(clock);
    await toggleCompletion(original.id, "psalms", 1);

    await changeStartDate(original, oct1);

    const originalStillThere = await db.readingYears.get(original.id);
    expect(originalStillThere?.startDate).toEqual(sep1); // unchanged
    const originalEncounters = await db.encounters
      .where("readingYearId")
      .equals(original.id)
      .toArray();
    expect(originalEncounters).toHaveLength(1); // still there
  });

  it("makes the new reading year active going forward", async () => {
    const clock = new FixedClock(sep1);
    const original = await getOrCreateActiveReadingYear(clock);
    await toggleCompletion(original.id, "psalms", 1);

    const result = await changeStartDate(original, oct1);

    const activeId = await getActiveReadingYearId();
    expect(activeId).toBe(result.readingYear.id);

    const fetchedAsActive = await getOrCreateActiveReadingYear(clock);
    expect(fetchedAsActive.id).toBe(result.readingYear.id);
    expect(fetchedAsActive.startDate).toEqual(oct1);
  });
});

describe("getOrCreateActiveReadingYear — backward compatibility", () => {
  it("adopts an existing reading year as active if no active pointer was ever set", async () => {
    // Simulate a pre-active-pointer install: a reading year exists, but
    // appState has no activeReadingYearId row.
    const legacyYear = {
      id: "legacy-id",
      startDate: sep1,
      createdAt: new Date().toISOString(),
    };
    await db.readingYears.add(legacyYear);

    const clock = new FixedClock(sep1);
    const fetched = await getOrCreateActiveReadingYear(clock);
    expect(fetched.id).toBe("legacy-id");

    const allYears = await db.readingYears.toArray();
    expect(allYears).toHaveLength(1); // did not create a duplicate
  });
});
