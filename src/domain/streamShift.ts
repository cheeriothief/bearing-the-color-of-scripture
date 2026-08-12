import type { LocalDate } from "../services/clock";
import { addDays } from "../services/clock";
import type { StreamShiftEvent, StreamKey } from "./types";
import { baseDateForOrdinal } from "./calendarMapping";
import { getReadingYearLength } from "./datasetAdapter";

/**
 * Total accumulated delay (in days) affecting a given ordinal in a stream,
 * from all shift events whose startingOrdinal is <= this ordinal.
 *
 * A shift never skips Scripture and never touches the other four streams —
 * this function only ever looks at events for the one stream it's given.
 */
export function cumulativeDelayForOrdinal(
  ordinal: number,
  shiftEvents: StreamShiftEvent[]
): number {
  return shiftEvents
    .filter((e) => e.startingOrdinal <= ordinal)
    .reduce((sum, e) => sum + e.delayDays, 0);
}

/** The actual calendar date an ordinal falls on, after applying shift events. */
export function effectiveDateForOrdinal(
  ordinal: number,
  startDate: LocalDate,
  shiftEvents: StreamShiftEvent[]
): LocalDate {
  const base = baseDateForOrdinal(ordinal, startDate);
  const delay = cumulativeDelayForOrdinal(ordinal, shiftEvents);
  return delay === 0 ? base : addDays(base, delay);
}

/**
 * Which ordinal (if any) in this stream has its effective date equal to the
 * given calendar date. Effective dates are strictly increasing in ordinal
 * (each ordinal's base date advances by exactly one day, and cumulative
 * delay never decreases), so at most one ordinal can match a given date.
 *
 * This walks the full reading year each call. For a 365-day plan that's
 * cheap; if this ever needs to run per-frame it should be memoized per
 * (readingYearId, stream, shiftEvents) instead.
 */
export function ordinalForEffectiveDate(
  date: LocalDate,
  startDate: LocalDate,
  shiftEvents: StreamShiftEvent[]
): number | null {
  const length = getReadingYearLength();
  for (let ordinal = 1; ordinal <= length; ordinal++) {
    const effective = effectiveDateForOrdinal(ordinal, startDate, shiftEvents);
    if (
      effective.year === date.year &&
      effective.month === date.month &&
      effective.day === date.day
    ) {
      return ordinal;
    }
    // Effective dates are monotonic — once we've passed the target date
    // with no match, there won't be a later match either.
    if (
      effective.year > date.year ||
      (effective.year === date.year && effective.month > date.month) ||
      (effective.year === date.year &&
        effective.month === date.month &&
        effective.day > date.day)
    ) {
      return null;
    }
  }
  return null;
}

export function shiftEventsForStream(
  events: StreamShiftEvent[],
  stream: StreamKey
): StreamShiftEvent[] {
  return events
    .filter((e) => e.stream === stream)
    .sort((a, b) => a.startingOrdinal - b.startingOrdinal);
}
