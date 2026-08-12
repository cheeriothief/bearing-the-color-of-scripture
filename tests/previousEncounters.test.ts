import { describe, it, expect, beforeEach } from "vitest";
import db from "../src/services/database";
import { findPriorOrdinalsWithSameReference, getPlanDay } from "../src/domain/datasetAdapter";
import { countEngagedEncounters, toggleCompletion } from "../src/services/encounterActions";
import { getTheme, setTheme, DEFAULT_THEME } from "../src/services/settingsRepo";

beforeEach(async () => {
  await db.readingYears.clear();
  await db.streamShiftEvents.clear();
  await db.encounters.clear();
  await db.passageNotes.clear();
  await db.settings.clear();
});

describe("findPriorOrdinalsWithSameReference", () => {
  it("finds Matthew 1's later occurrence in the Gospel rotation", () => {
    // Matthew 1 is read at ordinal 1 (Sept 1) AND again as part of the
    // Christmas swap at ordinal 114 (Dec 23) — see DECISIONS.md.
    const day114 = getPlanDay(114)!;
    const gospelRef = day114.streams.gospel!;
    expect(gospelRef.book).toBe("Matthew");
    expect(gospelRef.startChapter).toBe(1);

    const priors = findPriorOrdinalsWithSameReference("gospel", 114, gospelRef);
    expect(priors).toContain(1); // ordinal 1 is also Matthew 1
  });

  it("returns an empty array for a passage's first-ever occurrence", () => {
    const day1 = getPlanDay(1)!;
    const psalmsRef = day1.streams.psalms!;
    const priors = findPriorOrdinalsWithSameReference("psalms", 1, psalmsRef);
    expect(priors).toEqual([]);
  });

  it("never matches a different stream's occurrence of the same book/chapter", () => {
    // Contrived: search for a Psalms reference within the gospel stream —
    // should never match even if chapter numbers coincide.
    const fakeRef = { book: "Psalms", startChapter: 1, endChapter: 5 };
    const priors = findPriorOrdinalsWithSameReference("gospel", 365, fakeRef);
    expect(priors).toEqual([]);
  });
});

describe("countEngagedEncounters", () => {
  it("only counts prior ordinals the user actually has an encounter row for", async () => {
    const yearId = "year-1";
    await toggleCompletion(yearId, "gospel", 1); // engaged with ordinal 1

    // ordinal 1 engaged, ordinal 50 not engaged — only 1 should count
    const count = await countEngagedEncounters(yearId, "gospel", [1, 50]);
    expect(count).toBe(1);
  });

  it("returns 0 when there are no prior ordinals to check", async () => {
    const count = await countEngagedEncounters("year-1", "gospel", []);
    expect(count).toBe(0);
  });

  it("does not count encounters from a different reading year", async () => {
    await toggleCompletion("year-1", "gospel", 1);
    const count = await countEngagedEncounters("year-2", "gospel", [1]);
    expect(count).toBe(0);
  });
});

describe("theme setting", () => {
  it("defaults to Prayer Book before any preference is set", async () => {
    expect(await getTheme()).toBe("prayerbook");
    expect(DEFAULT_THEME).toBe("prayerbook");
  });

  it("persists a theme change", async () => {
    await setTheme("candlelight");
    expect(await getTheme()).toBe("candlelight");
  });
});
