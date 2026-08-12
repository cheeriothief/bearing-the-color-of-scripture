import type { ReadingPlanDataset, PlanDay, ScriptureReference, StreamKey } from "./types";
import rawDataset from "../data/reading-plan.json";

/**
 * The dataset adapter is the ONLY place in the app that reads
 * reading-plan.json. Everything else should go through this module's
 * functions rather than importing the JSON directly, so that (a) shape
 * validation happens in one place, and (b) swapping the dataset source
 * later (e.g. a versioned file, a remote fetch for updates) touches one file.
 *
 * This never regenerates or recomputes assignments from cadence rules — the
 * dataset is the sole source of truth, per the architecture decision in the
 * spec. This module only reads and indexes it.
 */

let cachedDataset: ReadingPlanDataset | null = null;
let cachedByOrdinal: Map<number, PlanDay> | null = null;

function validate(ds: ReadingPlanDataset): void {
  if (!Array.isArray(ds.days) || ds.days.length === 0) {
    throw new Error("Reading plan dataset has no days.");
  }
  if (ds.days.length !== ds.readingYearLength) {
    throw new Error(
      `Dataset declares readingYearLength=${ds.readingYearLength} but has ${ds.days.length} days.`
    );
  }
  const seen = new Set<number>();
  for (const day of ds.days) {
    if (seen.has(day.ordinal)) {
      throw new Error(`Duplicate ordinal ${day.ordinal} in dataset.`);
    }
    seen.add(day.ordinal);
  }
  for (let i = ds.ordinalBase; i < ds.ordinalBase + ds.readingYearLength; i++) {
    if (!seen.has(i)) {
      throw new Error(`Dataset is missing ordinal ${i}.`);
    }
  }
}

export function loadDataset(): ReadingPlanDataset {
  if (cachedDataset) return cachedDataset;
  const ds = rawDataset as unknown as ReadingPlanDataset;
  validate(ds);
  cachedDataset = ds;
  return ds;
}

function byOrdinalIndex(): Map<number, PlanDay> {
  if (cachedByOrdinal) return cachedByOrdinal;
  const ds = loadDataset();
  cachedByOrdinal = new Map(ds.days.map((d) => [d.ordinal, d]));
  return cachedByOrdinal;
}

export function getPlanDay(ordinal: number): PlanDay | undefined {
  return byOrdinalIndex().get(ordinal);
}

export function getReadingYearLength(): number {
  return loadDataset().readingYearLength;
}

/**
 * All prior ordinals (strictly before the given one) in this stream whose
 * Scripture reference is the exact same book and chapter range — i.e. every
 * earlier occasion the reading plan assigned this exact passage to this
 * stream. Used to power the "N previous encounters" indicator. This reads
 * only from the dataset; whether the user actually engaged with those past
 * occasions is a separate question answered by the encounters table.
 */
export function findPriorOrdinalsWithSameReference(
  stream: StreamKey,
  ordinal: number,
  reference: Pick<ScriptureReference, "book" | "startChapter" | "endChapter">
): number[] {
  const ds = loadDataset();
  const matches: number[] = [];
  for (const day of ds.days) {
    if (day.ordinal >= ordinal) break; // dataset is ordinal-ordered
    const ref = day.streams[stream];
    if (
      ref &&
      ref.book === reference.book &&
      ref.startChapter === reference.startChapter &&
      ref.endChapter === reference.endChapter
    ) {
      matches.push(day.ordinal);
    }
  }
  return matches;
}
