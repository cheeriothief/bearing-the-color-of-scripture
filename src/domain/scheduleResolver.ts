import type { LocalDate } from "../services/clock";
import type {
  ReadingYear,
  StreamShiftEvent,
  StreamKey,
  ResolvedReading,
} from "./types";
import { STREAM_KEYS } from "./types";
import { ordinalForEffectiveDate, shiftEventsForStream } from "./streamShift";
import { getPlanDay } from "./datasetAdapter";

/**
 * Resolve a single stream's reading for a given calendar date, or `undefined`
 * if this stream has no assignment on that date (no ordinal lands there, or
 * the dataset day has no entry for that stream — e.g. the Gospel's
 * Aug 26–31 gap). Per the spec, a missing assignment is simply omitted, not
 * displayed as "None".
 */
export function resolveStreamForDate(
  stream: StreamKey,
  date: LocalDate,
  readingYear: ReadingYear,
  allShiftEvents: StreamShiftEvent[]
): ResolvedReading | undefined {
  const streamEvents = shiftEventsForStream(allShiftEvents, stream);
  const ordinal = ordinalForEffectiveDate(date, readingYear.startDate, streamEvents);
  if (ordinal === null) return undefined;

  const planDay = getPlanDay(ordinal);
  const reference = planDay?.streams[stream];
  if (!reference) return undefined;

  return { stream, ordinal, reference };
}

/**
 * Resolve all five streams for a given calendar date. There is no longer a
 * single universal "plan day" once streams diverge — this is the function
 * that reconstructs "today's readings" by resolving each stream
 * independently against the same calendar date.
 */
export function resolveAllStreamsForDate(
  date: LocalDate,
  readingYear: ReadingYear,
  allShiftEvents: StreamShiftEvent[]
): ResolvedReading[] {
  const results: ResolvedReading[] = [];
  for (const stream of STREAM_KEYS) {
    const resolved = resolveStreamForDate(stream, date, readingYear, allShiftEvents);
    if (resolved) results.push(resolved);
  }
  return results;
}
