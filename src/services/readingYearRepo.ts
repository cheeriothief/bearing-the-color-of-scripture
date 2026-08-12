import db from "./database";
import type { ReadingYear } from "../domain/types";
import type { Clock, LocalDate } from "./clock";
import { localDateToISO } from "./clock";
import { getActiveReadingYearId, setActiveReadingYearId } from "./appStateRepo";

/**
 * Get the currently active reading year, creating the very first one
 * (bootstrapped to today's date, not the spec's default September 1 — see
 * DECISIONS.md) if none exists yet. Once a reading year exists, "active"
 * is tracked explicitly via appState rather than just "whichever one is
 * oldest" — this is what makes changeStartDate's new-reading-year path
 * actually take effect for the rest of the app.
 */
export async function getOrCreateActiveReadingYear(clock: Clock): Promise<ReadingYear> {
  const activeId = await getActiveReadingYearId();
  if (activeId) {
    const found = await db.readingYears.get(activeId);
    if (found) return found;
    // Active pointer referenced a reading year that no longer exists
    // (shouldn't normally happen) — fall through and create fresh.
  }

  // Backward-compat: an existing install from before the active-pointer
  // system existed. Adopt the oldest reading year as active rather than
  // creating a duplicate.
  const existing = await db.readingYears.orderBy("createdAt").first();
  if (existing) {
    await setActiveReadingYearId(existing.id);
    return existing;
  }

  const readingYear: ReadingYear = {
    id: crypto.randomUUID(),
    startDate: clock.today(),
    createdAt: new Date().toISOString(),
  };
  await db.readingYears.add(readingYear);
  await setActiveReadingYearId(readingYear.id);
  return readingYear;
}

export function readingYearLabel(readingYear: ReadingYear): string {
  return `Started ${localDateToISO(readingYear.startDate)}`;
}

/**
 * Whether this reading year has any activity that, per the spec, makes its
 * start date immutable: a completion, a stream shift, or a passage note.
 *
 * Daily and Monthly Reflections are deliberately NOT checked here, even
 * though the spec's prose lists them among the triggers — they're keyed to
 * calendar date/month rather than readingYearId in this schema (per the
 * spec's own "Daily Reflections are keyed to calendar date rather than
 * logical plan day" rule), so there's no reliable way to attribute a given
 * reflection to "this reading year" specifically. Documented as an
 * intentional, narrower interpretation in DECISIONS.md rather than left
 * silent.
 */
export async function hasActivity(readingYearId: string): Promise<boolean> {
  const encounterCount = await db.encounters
    .where("readingYearId")
    .equals(readingYearId)
    .count();
  if (encounterCount > 0) return true;

  const shiftCount = await db.streamShiftEvents
    .where("readingYearId")
    .equals(readingYearId)
    .count();
  return shiftCount > 0;
}

export type ChangeStartDateResult =
  | { kind: "updated"; readingYear: ReadingYear }
  | { kind: "created"; readingYear: ReadingYear; previousReadingYear: ReadingYear };

/**
 * Change the reading-year start date, per the spec's rule: if the current
 * reading year has no meaningful activity yet, the start date can simply
 * be edited in place. Once activity exists, changing the start date
 * instead creates a brand new Reading Year (preserving the old one and
 * everything in it) and makes the new one active going forward.
 */
export async function changeStartDate(
  currentReadingYear: ReadingYear,
  newStartDate: LocalDate
): Promise<ChangeStartDateResult> {
  const alreadyActive = await hasActivity(currentReadingYear.id);

  if (!alreadyActive) {
    const updated: ReadingYear = { ...currentReadingYear, startDate: newStartDate };
    await db.readingYears.put(updated);
    return { kind: "updated", readingYear: updated };
  }

  const created: ReadingYear = {
    id: crypto.randomUUID(),
    startDate: newStartDate,
    createdAt: new Date().toISOString(),
  };
  await db.readingYears.add(created);
  await setActiveReadingYearId(created.id);
  return { kind: "created", readingYear: created, previousReadingYear: currentReadingYear };
}
