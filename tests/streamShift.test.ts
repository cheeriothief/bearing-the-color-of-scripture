import { describe, it, expect } from "vitest";
import {
  cumulativeDelayForOrdinal,
  effectiveDateForOrdinal,
  ordinalForEffectiveDate,
} from "../src/domain/streamShift";
import type { StreamShiftEvent } from "../src/domain/types";
import type { LocalDate } from "../src/services/clock";

const start: LocalDate = { year: 2026, month: 9, day: 1 };

function makeEvent(overrides: Partial<StreamShiftEvent>): StreamShiftEvent {
  return {
    id: "evt-1",
    readingYearId: "year-1",
    stream: "oldTestament",
    startingOrdinal: 10,
    delayDays: 1,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("streamShift", () => {
  it("with no shift events, cumulative delay is zero everywhere", () => {
    expect(cumulativeDelayForOrdinal(50, [])).toBe(0);
  });

  it("a shift delays the triggering ordinal and everything after it, but not before", () => {
    const event = makeEvent({ startingOrdinal: 10, delayDays: 1 });
    expect(cumulativeDelayForOrdinal(9, [event])).toBe(0);
    expect(cumulativeDelayForOrdinal(10, [event])).toBe(1);
    expect(cumulativeDelayForOrdinal(11, [event])).toBe(1);
    expect(cumulativeDelayForOrdinal(365, [event])).toBe(1);
  });

  it("multiple shifts on the same stream accumulate", () => {
    const first = makeEvent({ startingOrdinal: 10, delayDays: 1 });
    const second = makeEvent({ id: "evt-2", startingOrdinal: 50, delayDays: 2 });
    expect(cumulativeDelayForOrdinal(5, [first, second])).toBe(0);
    expect(cumulativeDelayForOrdinal(20, [first, second])).toBe(1);
    expect(cumulativeDelayForOrdinal(100, [first, second])).toBe(3);
  });

  it("effectiveDateForOrdinal adds the delay onto the base date", () => {
    const event = makeEvent({ startingOrdinal: 5, delayDays: 3 });
    const effective = effectiveDateForOrdinal(5, start, [event]);
    // ordinal 5 base date = Sep 5, 2026; +3 days = Sep 8, 2026
    expect(effective).toEqual({ year: 2026, month: 9, day: 8 });
  });

  it("a shift never affects ordinals in a different stream", () => {
    const otherStreamEvent = makeEvent({ stream: "gospel", startingOrdinal: 1, delayDays: 5 });
    // caller is responsible for filtering by stream before calling — this
    // test documents that cumulativeDelayForOrdinal itself doesn't filter,
    // so callers MUST use shiftEventsForStream() first.
    expect(cumulativeDelayForOrdinal(1, [otherStreamEvent])).toBe(5);
  });

  it("ordinalForEffectiveDate finds the shifted ordinal on its new date", () => {
    const event = makeEvent({ startingOrdinal: 5, delayDays: 3 });
    // ordinal 5 now lands on Sep 8 instead of Sep 5
    expect(ordinalForEffectiveDate({ year: 2026, month: 9, day: 8 }, start, [event])).toBe(5);
    // Sep 5 resolves to nothing at all: ordinal 4 (unaffected, since the
    // shift only touches ordinal >= 5) still sits on its original date,
    // Sep 4. Ordinal 5 moved to Sep 8. Nothing backfills the gap this
    // creates on Sep 5 — a Shift Stream delay leaves a genuine gap in that
    // one stream rather than compressing earlier ordinals forward to fill it.
    expect(ordinalForEffectiveDate({ year: 2026, month: 9, day: 4 }, start, [event])).toBe(4);
    expect(ordinalForEffectiveDate({ year: 2026, month: 9, day: 5 }, start, [event])).toBeNull();
  });

  it("a shift never skips Scripture — every ordinal still resolves to exactly one date", () => {
    const event = makeEvent({ startingOrdinal: 100, delayDays: 4 });
    for (const ordinal of [98, 99, 100, 101, 200]) {
      const date = effectiveDateForOrdinal(ordinal, start, [event]);
      expect(ordinalForEffectiveDate(date, start, [event])).toBe(ordinal);
    }
  });
});
