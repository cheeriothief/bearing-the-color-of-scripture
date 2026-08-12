import { describe, it, expect } from "vitest";
import { resolveAllStreamsForDate, resolveStreamForDate } from "../src/domain/scheduleResolver";
import type { ReadingYear, StreamShiftEvent } from "../src/domain/types";

const readingYear: ReadingYear = {
  id: "year-1",
  startDate: { year: 2026, month: 9, day: 1 },
  createdAt: new Date().toISOString(),
};

describe("scheduleResolver", () => {
  it("resolves all five streams on day one with no shifts", () => {
    const results = resolveAllStreamsForDate(readingYear.startDate, readingYear, []);
    expect(results).toHaveLength(5);
    const gospel = results.find((r) => r.stream === "gospel");
    expect(gospel?.reference.display).toBe("Matthew 1");
    expect(gospel?.ordinal).toBe(1);
  });

  it("omits a stream entirely on a date with no assignment, rather than showing 'None'", () => {
    // Aug 26, 2027 is ordinal 360 — inside the documented Gospel gap.
    const date = { year: 2027, month: 8, day: 26 };
    const results = resolveAllStreamsForDate(date, readingYear, []);
    const streams = results.map((r) => r.stream);
    expect(streams).not.toContain("gospel");
    expect(streams).toContain("psalms"); // other streams still resolve normally
  });

  it("independently shifting one stream leaves the other four on their original dates", () => {
    const shift: StreamShiftEvent = {
      id: "evt-1",
      readingYearId: readingYear.id,
      stream: "oldTestament",
      startingOrdinal: 5,
      delayDays: 2,
      createdAt: new Date().toISOString(),
    };

    // Sep 5, 2026 (ordinal 5's original date) should no longer show an
    // Old Testament reading for ordinal 5 — it shifted 2 days later —
    // but Psalms/Proverbs/Gospel/NT on that date are untouched.
    const sep5 = { year: 2026, month: 9, day: 5 };
    const beforeShift = resolveStreamForDate("oldTestament", sep5, readingYear, [shift]);
    expect(beforeShift?.ordinal).not.toBe(5);

    const psalmsSep5 = resolveStreamForDate("psalms", sep5, readingYear, [shift]);
    expect(psalmsSep5?.ordinal).toBe(5); // unaffected by the OT-only shift

    const sep7 = { year: 2026, month: 9, day: 7 };
    const otSep7 = resolveStreamForDate("oldTestament", sep7, readingYear, [shift]);
    expect(otSep7?.ordinal).toBe(5); // ordinal 5's OT reading now lands here
  });
});
