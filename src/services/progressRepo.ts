import db from "./database";
import { loadDataset, getPlanDay } from "../domain/datasetAdapter";
import { STREAM_KEYS } from "../domain/types";
import type { StreamKey } from "../domain/types";
import { BIBLE_BOOK_ORDER, compareBookOrder } from "../domain/bibleBooks";

export interface StreamProgress {
  stream: StreamKey;
  totalAssignments: number;
  completedCount: number;
  booksEncountered: string[]; // canonical order, books with >= 1 completed reading in this stream
}

/**
 * Per-stream completion counts and which books have been touched at least
 * once. Deliberately does NOT compute streaks, percentages framed as
 * "performance," or anything comparative — per the spec, Progress describes
 * where the user has traveled, not how well they're doing.
 */
export async function getStreamProgress(readingYearId: string): Promise<StreamProgress[]> {
  const dataset = loadDataset();
  const results: StreamProgress[] = [];

  for (const stream of STREAM_KEYS) {
    const totalAssignments = dataset.days.filter((d) => d.streams[stream]).length;

    const completedEncounters = await db.encounters
      .where("readingYearId")
      .equals(readingYearId)
      .and((e) => e.stream === stream && e.completedAt !== null)
      .toArray();

    const bookSet = new Set<string>();
    for (const enc of completedEncounters) {
      const ref = getPlanDay(enc.ordinal)?.streams[stream];
      if (ref) bookSet.add(ref.book);
    }
    const booksEncountered = BIBLE_BOOK_ORDER.filter((b) => bookSet.has(b)).sort(compareBookOrder);

    results.push({
      stream,
      totalAssignments,
      completedCount: completedEncounters.length,
      booksEncountered,
    });
  }

  return results;
}

export interface RepeatedPassage {
  stream: StreamKey;
  book: string;
  startChapter: number;
  endChapter: number;
  display: string;
  encounterCount: number;
}

/**
 * Passages the user has personally engaged with (completed or noted) more
 * than once this reading year — a quiet record of repeated encounters with
 * the same Scripture, not a leaderboard.
 */
export async function getRepeatedPassages(readingYearId: string): Promise<RepeatedPassage[]> {
  const encounters = await db.encounters.where("readingYearId").equals(readingYearId).toArray();
  const grouped = new Map<string, RepeatedPassage>();

  for (const enc of encounters) {
    const ref = getPlanDay(enc.ordinal)?.streams[enc.stream];
    if (!ref) continue;
    const key = `${enc.stream}|${ref.book}|${ref.startChapter}|${ref.endChapter}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.encounterCount += 1;
    } else {
      grouped.set(key, {
        stream: enc.stream,
        book: ref.book,
        startChapter: ref.startChapter,
        endChapter: ref.endChapter,
        display: ref.display,
        encounterCount: 1,
      });
    }
  }

  return [...grouped.values()]
    .filter((p) => p.encounterCount > 1)
    .sort((a, b) => compareBookOrder(a.book, b.book) || a.startChapter - b.startChapter);
}
