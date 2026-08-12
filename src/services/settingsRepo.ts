import db from "./database";
import type { StreamKey } from "../domain/types";
import { STREAM_KEYS } from "../domain/types";

export type Session = "morning" | "evening";
export type StreamSessionAssignment = Record<StreamKey, Session>;

const STREAM_SESSION_KEY = "streamSessionAssignment";

/**
 * Default assignment, used only the first time the app runs (before the
 * user has expressed a preference). This split is an arbitrary but
 * reasonable starting point — documented as a reversible default in
 * DECISIONS.md — not a claim about how anyone should structure their day.
 * The user can reassign any stream to either session at any time.
 */
const DEFAULT_ASSIGNMENT: StreamSessionAssignment = {
  psalms: "morning",
  proverbs: "morning",
  gospel: "morning",
  oldTestament: "evening",
  newTestament: "evening",
};

export async function getStreamSessionAssignment(): Promise<StreamSessionAssignment> {
  const row = await db.settings.get(STREAM_SESSION_KEY);
  if (!row) return { ...DEFAULT_ASSIGNMENT };
  const stored = row.value as Partial<StreamSessionAssignment>;
  // Merge over defaults so a dataset/stream-list change never leaves a
  // stream without an assignment.
  const merged = { ...DEFAULT_ASSIGNMENT, ...stored };
  return merged;
}

export async function setStreamSession(stream: StreamKey, session: Session): Promise<void> {
  const current = await getStreamSessionAssignment();
  const next = { ...current, [stream]: session };
  await db.settings.put({ key: STREAM_SESSION_KEY, value: next });
}

export function streamsForSession(
  assignment: StreamSessionAssignment,
  session: Session
): StreamKey[] {
  return STREAM_KEYS.filter((s) => assignment[s] === session);
}

/**
 * Which session the Reading Desk should open to, based on time of day.
 * Noon is an arbitrary but reasonable cutoff — documented as a reversible
 * default. The user can always switch sessions manually regardless of what
 * this returns.
 */
export function defaultSessionForTime(now: Date): Session {
  return now.getHours() < 12 ? "morning" : "evening";
}
