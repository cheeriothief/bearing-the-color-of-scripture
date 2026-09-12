import db from "./database";
import type { LocalDate } from "./clock";
import { compareLocalDates } from "./clock";
import type { ReadingYear, ResolvedReading, StreamKey, StreamShiftEvent } from "../domain/types";
import { STREAM_KEYS } from "../domain/types";
import { loadDataset } from "../domain/datasetAdapter";
import { effectiveDateForOrdinal, shiftEventsForStream } from "../domain/streamShift";

export interface StreamCursor {
  ordinal: number | null;
  initializedAt: string;
}

export function streamCursorKey(readingYearId: string, stream: StreamKey): string {
  return `readingProgress:${readingYearId}:${stream}`;
}

export function nextAssignedOrdinal(stream: StreamKey, afterOrdinal: number): number | null {
  const next = loadDataset().days.find(
    (day) => day.ordinal > afterOrdinal && day.streams[stream] !== undefined
  );
  return next?.ordinal ?? null;
}

function firstAssignedOrdinal(stream: StreamKey): number | null {
  return loadDataset().days.find((day) => day.streams[stream] !== undefined)?.ordinal ?? null;
}

/** Seed a newly-created cycle before calendar-era migration can apply to it. */
export async function initializeFreshReadingProgression(readingYearId: string): Promise<void> {
  const initializedAt = new Date().toISOString();
  await db.appState.bulkPut(
    STREAM_KEYS.map((stream) => ({
      key: streamCursorKey(readingYearId, stream),
      value: { ordinal: firstAssignedOrdinal(stream), initializedAt } satisfies StreamCursor,
    }))
  );
}

/**
 * Establish the completion-driven boundary for an installation that has no
 * cursor yet. A genuinely fresh reading year starts at each stream's first
 * assignment. An older, already-active calendar-era year starts at the first
 * assignment whose former effective date has not passed. This deliberately
 * does not reinterpret older omissions as debt, and it never changes an
 * encounter or its historical timestamps.
 */
function migrationOrdinal(
  stream: StreamKey,
  today: LocalDate,
  readingYear: ReadingYear,
  allShiftEvents: StreamShiftEvent[],
  hasHistoricalActivity: boolean
): number | null {
  if (!hasHistoricalActivity && compareLocalDates(today, readingYear.startDate) <= 0) {
    return firstAssignedOrdinal(stream);
  }

  const shifts = shiftEventsForStream(allShiftEvents, stream);
  const candidate = loadDataset().days.find((day) => {
    if (!day.streams[stream]) return false;
    return compareLocalDates(effectiveDateForOrdinal(day.ordinal, readingYear.startDate, shifts), today) >= 0;
  });
  return candidate?.ordinal ?? null;
}

function validCursor(value: unknown, stream: StreamKey): StreamCursor | null {
  if (!value || typeof value !== "object") return null;
  const cursor = value as Partial<StreamCursor>;
  if (typeof cursor.initializedAt !== "string") return null;
  if (cursor.ordinal === null) return cursor as StreamCursor;
  if (!Number.isInteger(cursor.ordinal)) return null;
  const day = loadDataset().days.find(({ ordinal }) => ordinal === cursor.ordinal);
  return day?.streams[stream] ? (cursor as StreamCursor) : null;
}

async function resolveOne(
  stream: StreamKey,
  today: LocalDate,
  readingYear: ReadingYear,
  allShiftEvents: StreamShiftEvent[],
  hasHistoricalActivity: boolean,
  persist: boolean
): Promise<ResolvedReading | undefined> {
  const key = streamCursorKey(readingYear.id, stream);
  const stored = validCursor((await db.appState.get(key))?.value, stream);
  let ordinal = stored
    ? stored.ordinal
    : migrationOrdinal(stream, today, readingYear, allShiftEvents, hasHistoricalActivity);

  // Reconcile defensively: a completion may have committed before a view
  // refreshed, or a restored cursor may point at an already-complete entry.
  while (ordinal !== null) {
    const encounter = await db.encounters
      .where("[readingYearId+stream+ordinal]")
      .equals([readingYear.id, stream, ordinal])
      .first();
    if (!encounter?.completedAt) break;
    ordinal = nextAssignedOrdinal(stream, ordinal);
  }

  if (persist && (!stored || stored.ordinal !== ordinal)) {
    await db.appState.put({
      key,
      value: { ordinal, initializedAt: stored?.initializedAt ?? new Date().toISOString() } satisfies StreamCursor,
    });
  }

  if (ordinal === null) return undefined;
  const reference = loadDataset().days.find((day) => day.ordinal === ordinal)?.streams[stream];
  return reference ? { stream, ordinal, reference } : undefined;
}

/** The single source of truth for the five independently prescribed readings. */
export async function resolveCurrentReadings(
  today: LocalDate,
  readingYear: ReadingYear,
  allShiftEvents: StreamShiftEvent[],
  options: { persist?: boolean } = {}
): Promise<ResolvedReading[]> {
  const hasHistoricalActivity =
    (await db.encounters.where("readingYearId").equals(readingYear.id).count()) > 0 ||
    allShiftEvents.some((event) => event.readingYearId === readingYear.id);
  const readings = await Promise.all(
    STREAM_KEYS.map((stream) =>
      resolveOne(
        stream,
        today,
        readingYear,
        allShiftEvents,
        hasHistoricalActivity,
        options.persist !== false
      )
    )
  );
  return readings.filter((reading): reading is ResolvedReading => reading !== undefined);
}
