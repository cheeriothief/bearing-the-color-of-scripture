import db, { getOrCreateEncounter, type EncounterRecord } from "./database";
import type { StreamKey } from "../domain/types";

export async function findEncounter(
  readingYearId: string,
  stream: StreamKey,
  ordinal: number
): Promise<EncounterRecord | undefined> {
  return db.encounters
    .where("[readingYearId+stream+ordinal]")
    .equals([readingYearId, stream, ordinal])
    .first();
}

/**
 * Toggle a reading's completion. A restrained gesture, per the spec — this
 * function does nothing but flip a timestamp. No streaks, no counters, no
 * side effects beyond the one row changing.
 */
export async function toggleCompletion(
  readingYearId: string,
  stream: StreamKey,
  ordinal: number
): Promise<EncounterRecord> {
  const encounter = await getOrCreateEncounter(readingYearId, stream, ordinal);
  const nextCompletedAt = encounter.completedAt ? null : new Date().toISOString();
  await db.encounters.update(encounter.id, { completedAt: nextCompletedAt });
  return { ...encounter, completedAt: nextCompletedAt };
}

export async function getPassageNote(encounterId: string): Promise<string> {
  const note = await db.passageNotes.where("encounterId").equals(encounterId).first();
  return note?.markdown ?? "";
}

/**
 * Save a passage note tied to this specific encounter (this one occurrence
 * of this stream's ordinal within this reading year) — not a permanent note
 * on the passage itself. Re-reading the same chapter later in the year, via
 * a later pass or a shift, gets its own separate note.
 */
export async function savePassageNote(encounterId: string, markdown: string): Promise<void> {
  const existing = await db.passageNotes.where("encounterId").equals(encounterId).first();
  const now = new Date().toISOString();
  if (existing) {
    await db.passageNotes.update(existing.id, { markdown, updatedAt: now });
  } else {
    await db.passageNotes.add({
      id: crypto.randomUUID(),
      encounterId,
      markdown,
      createdAt: now,
      updatedAt: now,
    });
  }
}

/**
 * How many of the given prior ordinals (same passage, earlier occasions —
 * see findPriorOrdinalsWithSameReference) the user actually has an
 * encounter row for. This is what "N previous encounters" should count:
 * times the user engaged with this exact passage before, not just times
 * the plan happened to schedule it.
 */
export async function countEngagedEncounters(
  readingYearId: string,
  stream: StreamKey,
  priorOrdinals: number[]
): Promise<number> {
  if (priorOrdinals.length === 0) return 0;
  const rows = await db.encounters
    .where("[readingYearId+stream+ordinal]")
    .anyOf(priorOrdinals.map((ordinal) => [readingYearId, stream, ordinal]))
    .toArray();
  return rows.length;
}
