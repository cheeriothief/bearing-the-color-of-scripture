import { beforeEach, describe, expect, it } from "vitest";
import db, { getOrCreateEncounter } from "../src/services/database";
import { loadDataset } from "../src/domain/datasetAdapter";
import type { ReadingYear, StreamKey } from "../src/domain/types";
import { resolveCurrentReadings, streamCursorKey } from "../src/services/readingProgressionRepo";
import { toggleCompletion } from "../src/services/encounterActions";

const year: ReadingYear = {
  id: "progress-year",
  startDate: { year: 2026, month: 9, day: 1 },
  createdAt: "2026-09-01T08:00:00.000Z",
};
const monday = { year: 2026, month: 9, day: 1 };

beforeEach(async () => {
  await db.readingYears.clear();
  await db.streamShiftEvents.clear();
  await db.encounters.clear();
  await db.appState.clear();
  await db.readingYears.add(year);
});

async function ordinals(date = monday): Promise<Record<string, number>> {
  return Object.fromEntries(
    (await resolveCurrentReadings(date, year, [])).map((reading) => [reading.stream, reading.ordinal])
  );
}

describe("completion-driven reading progression", () => {
  it("keeps incomplete readings through midnight and multiple missed days", async () => {
    expect((await ordinals({ year: 2026, month: 9, day: 1 })).gospel).toBe(1);
    expect((await ordinals({ year: 2026, month: 9, day: 2 })).gospel).toBe(1);
    expect((await ordinals({ year: 2026, month: 9, day: 8 })).gospel).toBe(1);
  });

  it("immediately advances only the completed stream in authoritative dataset order", async () => {
    const before = await ordinals();
    const psalmOrdinal = before.psalms;
    await toggleCompletion(year.id, "psalms", psalmOrdinal);
    const after = await ordinals();

    expect(after.psalms).toBe(
      loadDataset().days.find((day) => day.ordinal > psalmOrdinal && day.streams.psalms)?.ordinal
    );
    for (const stream of ["proverbs", "oldTestament", "gospel", "newTestament"]) {
      expect(after[stream]).toBe(before[stream]);
    }
  });

  it("allows all five streams to occupy independent positions", async () => {
    const advances: Partial<Record<StreamKey, number>> = {
      psalms: 4,
      proverbs: 1,
      oldTestament: 3,
      gospel: 2,
      newTestament: 5,
    };
    for (const [stream, count] of Object.entries(advances) as [StreamKey, number][]) {
      for (let index = 0; index < count; index += 1) {
        const current = (await resolveCurrentReadings(monday, year, [])).find((r) => r.stream === stream)!;
        await toggleCompletion(year.id, stream, current.ordinal);
      }
    }
    expect(new Set(Object.values(await ordinals())).size).toBeGreaterThan(1);
  });

  it("distinguishes repeated plan occurrences by stream and ordinal", async () => {
    const occurrences = loadDataset().days
      .filter((day) => day.streams.psalms?.display === "Psalms 1–5")
      .map((day) => day.ordinal);
    expect(occurrences.length).toBeGreaterThan(1);
    await db.appState.put({
      key: streamCursorKey(year.id, "psalms"),
      value: { ordinal: occurrences[0], initializedAt: "2026-09-01T08:00:00.000Z" },
    });
    await toggleCompletion(year.id, "psalms", occurrences[0]);
    await db.appState.put({
      key: streamCursorKey(year.id, "psalms"),
      value: { ordinal: occurrences[1], initializedAt: "2026-09-01T08:00:00.000Z" },
    });

    const later = (await resolveCurrentReadings(monday, year, [])).find((r) => r.stream === "psalms");
    expect(later?.ordinal).toBe(occurrences[1]);
  });

  it("migrates an existing calendar-era year at its present boundary without rewriting history", async () => {
    const old = await getOrCreateEncounter(year.id, "gospel", 2);
    const original = { ...old, completedAt: "2026-09-02T20:00:00.000Z" };
    await db.encounters.put(original);

    const current = await resolveCurrentReadings({ year: 2026, month: 9, day: 20 }, year, []);
    expect(current.find((r) => r.stream === "gospel")?.ordinal).toBe(20);
    expect(await db.encounters.get(old.id)).toEqual(original);
  });

  it("starts a fresh reading year at each stream's first assignment", async () => {
    const current = await resolveCurrentReadings(monday, year, []);
    for (const reading of current) {
      expect(reading.ordinal).toBe(
        loadDataset().days.find((day) => day.streams[reading.stream])?.ordinal
      );
    }
  });

  it("stops after a stream's final assignment without wrapping", async () => {
    const final = [...loadDataset().days].reverse().find((day) => day.streams.gospel)!;
    await db.appState.put({
      key: streamCursorKey(year.id, "gospel"),
      value: { ordinal: final.ordinal, initializedAt: "2026-09-01T08:00:00.000Z" },
    });
    await toggleCompletion(year.id, "gospel", final.ordinal);
    const current = await resolveCurrentReadings(monday, year, []);
    expect(current.some((reading) => reading.stream === "gospel")).toBe(false);
  });
});
