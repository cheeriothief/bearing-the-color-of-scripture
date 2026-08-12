import { describe, it, expect, beforeEach } from "vitest";
import db from "../src/services/database";
import {
  getDailyReflection,
  saveDailyReflection,
  getMonthlyReflection,
  saveMonthlyReflection,
} from "../src/services/reflectionRepo";
import { reindexTags, findByTag, listAllTags } from "../src/services/tagRepo";
import { toggleCompletion, savePassageNote } from "../src/services/encounterActions";
import type { LocalDate } from "../src/services/clock";

beforeEach(async () => {
  await db.dailyReflections.clear();
  await db.monthlyReflections.clear();
  await db.tagReferences.clear();
  await db.encounters.clear();
  await db.passageNotes.clear();
});

const sep1: LocalDate = { year: 2026, month: 9, day: 1 };
const sep2: LocalDate = { year: 2026, month: 9, day: 2 };

describe("Daily Reflection", () => {
  it("has no reflection before anything is saved", async () => {
    expect(await getDailyReflection(sep1)).toBeUndefined();
  });

  it("saves and retrieves a reflection for a specific date", async () => {
    await saveDailyReflection(sep1, "Grateful for a quiet morning.");
    const result = await getDailyReflection(sep1);
    expect(result?.markdown).toBe("Grateful for a quiet morning.");
  });

  it("keeps separate reflections for separate dates", async () => {
    await saveDailyReflection(sep1, "Day one thoughts.");
    await saveDailyReflection(sep2, "Day two thoughts.");
    expect((await getDailyReflection(sep1))?.markdown).toBe("Day one thoughts.");
    expect((await getDailyReflection(sep2))?.markdown).toBe("Day two thoughts.");
  });

  it("updates in place rather than creating a second row for the same date", async () => {
    await saveDailyReflection(sep1, "draft one");
    await saveDailyReflection(sep1, "draft two");
    expect((await getDailyReflection(sep1))?.markdown).toBe("draft two");
    const all = await db.dailyReflections.toArray();
    expect(all).toHaveLength(1);
  });
});

describe("Monthly Reflection", () => {
  it("saves and retrieves a reflection keyed by month, not exact date", async () => {
    await saveMonthlyReflection(sep1, "September reflections.");
    // A different day in the same month should retrieve the same reflection.
    const midMonth: LocalDate = { year: 2026, month: 9, day: 15 };
    expect((await getMonthlyReflection(midMonth))?.markdown).toBe("September reflections.");
  });

  it("keeps separate reflections for separate months", async () => {
    const oct1: LocalDate = { year: 2026, month: 10, day: 1 };
    await saveMonthlyReflection(sep1, "September.");
    await saveMonthlyReflection(oct1, "October.");
    expect((await getMonthlyReflection(sep1))?.markdown).toBe("September.");
    expect((await getMonthlyReflection(oct1))?.markdown).toBe("October.");
  });
});

describe("tag reindexing", () => {
  it("indexes tags when a daily reflection is saved", async () => {
    await saveDailyReflection(sep1, "Thinking about #prayer and #patience today.");
    const prayerRefs = await findByTag("prayer");
    expect(prayerRefs).toHaveLength(1);
    expect(prayerRefs[0].sourceType).toBe("dailyReflection");
  });

  it("re-saving with different tags removes the old tag rows", async () => {
    await saveDailyReflection(sep1, "About #prayer.");
    await saveDailyReflection(sep1, "Now about #patience instead.");
    expect(await findByTag("prayer")).toHaveLength(0);
    expect(await findByTag("patience")).toHaveLength(1);
  });

  it("indexes tags when a passage note is saved", async () => {
    const encounter = await toggleCompletion("year-1", "gospel", 1);
    await savePassageNote(encounter.id, "Noticing the #genealogy here. #return-to-this");
    const tags = await listAllTags();
    expect(tags).toContain("genealogy");
    expect(tags).toContain("return-to-this");
  });

  it("reindexTags directly removes all tags when markdown is cleared", async () => {
    await reindexTags("dailyReflection", "source-1", "#onetag here");
    expect(await findByTag("onetag")).toHaveLength(1);
    await reindexTags("dailyReflection", "source-1", "no tags anymore");
    expect(await findByTag("onetag")).toHaveLength(0);
  });

  it("listAllTags deduplicates across multiple sources", async () => {
    await saveDailyReflection(sep1, "#shared tag here");
    const encounter = await toggleCompletion("year-1", "psalms", 1);
    await savePassageNote(encounter.id, "#shared tag again");
    const tags = await listAllTags();
    expect(tags.filter((t) => t === "shared")).toHaveLength(1);
  });
});
