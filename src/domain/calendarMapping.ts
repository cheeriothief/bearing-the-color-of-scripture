import {
  type LocalDate,
  addDays,
  compareLocalDates,
  localDateToISO,
} from "../services/clock";

/**
 * Base (unshifted) calendar mapping for the 365-day plan.
 *
 * The plan is always exactly 365 reading-days. February 29 is a "no new
 * reading" day: it consumes a calendar day but never receives its own base
 * ordinal. So walking forward from the reading year's start date, ordinal N
 * lands on the Nth calendar day *after skipping any Feb 29 encountered along
 * the way*.
 *
 * This module only computes the BASE mapping (no stream shifts applied).
 * Shift events are layered on top by streamShift.ts.
 */

function isFeb29(d: LocalDate): boolean {
  return d.month === 2 && d.day === 29;
}

/** The calendar date a given base ordinal lands on, given a reading year start date. */
export function baseDateForOrdinal(ordinal: number, startDate: LocalDate): LocalDate {
  if (ordinal < 1) {
    throw new Error(`Ordinal must be >= 1, got ${ordinal}`);
  }
  let date = startDate;
  let remaining = ordinal - 1; // steps still to take from the start date
  while (remaining > 0) {
    date = addDays(date, 1);
    if (isFeb29(date)) {
      // Feb 29 doesn't consume an ordinal step; skip it without decrementing.
      continue;
    }
    remaining -= 1;
  }
  return date;
}

/**
 * The base ordinal that a given calendar date corresponds to, or `null` if
 * the date is Feb 29 (no base ordinal — though shifted/outstanding readings
 * may still legitimately appear there) or falls before the reading year's
 * start date.
 */
export function baseOrdinalForDate(date: LocalDate, startDate: LocalDate): number | null {
  if (compareLocalDates(date, startDate) < 0) return null;
  if (isFeb29(date)) return null;

  let ordinal = 1;
  let cursor = startDate;
  while (compareLocalDates(cursor, date) < 0) {
    cursor = addDays(cursor, 1);
    if (isFeb29(cursor)) continue;
    ordinal += 1;
  }
  return ordinal;
}

export { localDateToISO };
