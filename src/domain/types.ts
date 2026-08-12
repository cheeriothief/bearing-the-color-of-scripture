import type { LocalDate } from "../services/clock";

export type StreamKey =
  | "psalms"
  | "proverbs"
  | "oldTestament"
  | "gospel"
  | "newTestament";

export const STREAM_KEYS: StreamKey[] = [
  "psalms",
  "proverbs",
  "oldTestament",
  "gospel",
  "newTestament",
];

export interface ScriptureReference {
  book: string;
  startChapter: number;
  endChapter: number;
  /** Human-facing display string, e.g. "Genesis 1–2" (en dash). */
  display: string;
}

/** One row of the authoritative dataset: a plan ordinal and its per-stream assignments. */
export interface PlanDay {
  ordinal: number;
  /** Missing streams are simply absent from this object — never "None". */
  streams: Partial<Record<StreamKey, ScriptureReference>>;
}

export interface ReadingPlanDataset {
  datasetVersion: string;
  planName: string;
  readingYearLength: number;
  ordinalBase: number;
  days: PlanDay[];
}

/**
 * A user's instance of running the plan, anchored to a start date.
 * Immutable once meaningful activity exists (completion, shift, note, or
 * reflection) — see the spec's start-date-change rule. Enforcing that
 * immutability is an application-layer concern, not this type's job.
 */
export interface ReadingYear {
  id: string;
  startDate: LocalDate;
  createdAt: string;
}

/**
 * An auditable record of a stream falling behind schedule. Scheduled dates
 * are always *derived* from the dataset plus these events — never stored as
 * authoritative dates directly on an encounter.
 */
export interface StreamShiftEvent {
  id: string;
  readingYearId: string;
  stream: StreamKey;
  /** The first ordinal in this stream affected by the shift. */
  startingOrdinal: number;
  /** Positive number of calendar days this ordinal (and all later ordinals
   *  in this stream) are delayed. */
  delayDays: number;
  createdAt: string;
}

/** A single stream's reading, resolved onto a specific calendar date. */
export interface ResolvedReading {
  stream: StreamKey;
  ordinal: number;
  reference: ScriptureReference;
}
