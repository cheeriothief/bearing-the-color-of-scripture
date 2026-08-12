import { describe, it, expect } from "vitest";
import { baseDateForOrdinal, baseOrdinalForDate } from "../src/domain/calendarMapping";
import type { LocalDate } from "../src/services/clock";

describe("calendarMapping — non-leap year", () => {
  const start: LocalDate = { year: 2026, month: 9, day: 1 };

  it("maps ordinal 1 to the start date", () => {
    expect(baseDateForOrdinal(1, start)).toEqual(start);
  });

  it("maps ordinal 365 to Aug 31 of the following year", () => {
    expect(baseDateForOrdinal(365, start)).toEqual({ year: 2027, month: 8, day: 31 });
  });

  it("round-trips date -> ordinal -> date", () => {
    const someOrdinal = 200;
    const date = baseDateForOrdinal(someOrdinal, start);
    expect(baseOrdinalForDate(date, start)).toBe(someOrdinal);
  });

  it("returns null for a date before the start date", () => {
    expect(baseOrdinalForDate({ year: 2026, month: 8, day: 31 }, start)).toBeNull();
  });
});

describe("calendarMapping — leap year (Feb 29 no-new-reading rule)", () => {
  // 2028 is a leap year. Start the reading year Jan 1, 2028 so Feb 29, 2028
  // falls inside the plan's span.
  const start: LocalDate = { year: 2028, month: 1, day: 1 };

  it("Feb 29 has no base ordinal", () => {
    expect(baseOrdinalForDate({ year: 2028, month: 2, day: 29 }, start)).toBeNull();
  });

  it("does not consume an ordinal for Feb 29 — Mar 1 gets the ordinal that would naturally follow Feb 28", () => {
    // Ordinal for Feb 28, 2028 (day 59 of the year, since Jan has 31 + Feb 28 = 59)
    const feb28Ordinal = baseOrdinalForDate({ year: 2028, month: 2, day: 28 }, start);
    const mar1Ordinal = baseOrdinalForDate({ year: 2028, month: 3, day: 1 }, start);
    expect(feb28Ordinal).not.toBeNull();
    expect(mar1Ordinal).toBe(feb28Ordinal! + 1);
  });

  it("the plan still totals exactly 365 base ordinals across the leap year", () => {
    // Starting Jan 1, 2028 (a leap year with 366 calendar days), one of
    // those calendar days (Feb 29) is spent without consuming an ordinal.
    // So the 365th reading-ordinal lands on the 366th calendar day of the
    // year — Dec 31 — not Dec 30. The plan still contains exactly 365
    // readings; it just takes 366 calendar days to deliver them when a
    // leap day falls inside its span.
    const ordinal365Date = baseDateForOrdinal(365, start);
    expect(ordinal365Date).toEqual({ year: 2028, month: 12, day: 31 });
  });

  it("round-trips correctly across the Feb 29 boundary", () => {
    const ordinal = 65; // lands after Feb 29 given the leap-day skip
    const date = baseDateForOrdinal(ordinal, start);
    expect(baseOrdinalForDate(date, start)).toBe(ordinal);
  });
});
