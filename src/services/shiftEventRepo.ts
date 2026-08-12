import db from "./database";
import type { StreamShiftEvent, StreamKey } from "../domain/types";

export async function listShiftEvents(readingYearId: string): Promise<StreamShiftEvent[]> {
  return db.streamShiftEvents.where("readingYearId").equals(readingYearId).toArray();
}

/**
 * Record a Shift Stream decision: the given ordinal (and everything later
 * in this one stream) moves one calendar day later. This never touches the
 * other four streams and never skips or regenerates any Scripture
 * assignment — it only adds an auditable delay event that the schedule
 * resolver layers on top of the dataset's base dates.
 */
export async function shiftStream(
  readingYearId: string,
  stream: StreamKey,
  startingOrdinal: number,
  delayDays = 1
): Promise<StreamShiftEvent> {
  const event: StreamShiftEvent = {
    id: crypto.randomUUID(),
    readingYearId,
    stream,
    startingOrdinal,
    delayDays,
    createdAt: new Date().toISOString(),
  };
  await db.streamShiftEvents.add(event);
  return event;
}
