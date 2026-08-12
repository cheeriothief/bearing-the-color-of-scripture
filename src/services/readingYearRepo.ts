import db from "./database";
import type { ReadingYear } from "../domain/types";
import type { Clock } from "./clock";
import { localDateToISO } from "./clock";

/**
 * Phase 2 scope: exactly one active reading year, bootstrapped automatically
 * on first use rather than through a start-date-picker UI (that's a later
 * phase). Multiple concurrent reading years (per the spec's "choosing a new
 * start date creates a new Reading Year, preserving the old one" rule) are
 * a real requirement, but the UI for that isn't needed to prove the
 * underlying domain model works — this repo just needs to not preclude it
 * later, which storing everything by readingYearId already ensures.
 */
export async function getOrCreateActiveReadingYear(clock: Clock): Promise<ReadingYear> {
  const existing = await db.readingYears.orderBy("createdAt").first();
  if (existing) return existing;

  const readingYear: ReadingYear = {
    id: crypto.randomUUID(),
    startDate: clock.today(),
    createdAt: new Date().toISOString(),
  };
  await db.readingYears.add(readingYear);
  return readingYear;
}

export function readingYearLabel(readingYear: ReadingYear): string {
  return `Started ${localDateToISO(readingYear.startDate)}`;
}
