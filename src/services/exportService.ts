import { strToU8, zipSync } from "fflate";
import db from "./database";
import { getPlanDay } from "../domain/datasetAdapter";
import { extractTags } from "../domain/tagParser";
import { localDateToISO } from "./clock";

const ROOT = "Bearing the Color of Scripture";

function frontmatter(fields: Record<string, string | string[]>): string {
  const lines = ["---"];
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      lines.push(`${key}: [${value.map((v) => JSON.stringify(v)).join(", ")}]`);
    } else {
      lines.push(`${key}: ${JSON.stringify(value)}`);
    }
  }
  lines.push("---", "");
  return lines.join("\n");
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function readingYearDirectory(readingYearId: string, startDate: string): string {
  return `${startDate}--${encodeURIComponent(readingYearId)}`;
}

/**
 * Build the human-readable Markdown export as a ZIP archive, per the
 * spec's folder structure: Journal (Daily Reflections), Monthly
 * Reflections, Passage Notes (organized by biblical book), and Metadata
 * (reading progress). Tags live in each file's frontmatter, regenerated
 * from the content at export time — never a separate tags directory, since
 * the spec calls tags "regenerable" rather than a stored export artifact.
 *
 * Uses fflate, per the spec's explicit suggestion for lightweight ZIP
 * generation.
 */
export async function buildMarkdownExportZip(): Promise<Uint8Array> {
  const files: Record<string, Uint8Array> = {};

  const dailyReflections = await db.dailyReflections.toArray();
  for (const r of dailyReflections) {
    if (!r.markdown.trim()) continue;
    const tags = extractTags(r.markdown);
    const content = frontmatter({ date: r.date, tags }) + r.markdown;
    files[`${ROOT}/Journal/${r.date}.md`] = strToU8(content);
  }

  const monthlyReflections = await db.monthlyReflections.toArray();
  for (const r of monthlyReflections) {
    if (!r.markdown.trim()) continue;
    const tags = extractTags(r.markdown);
    const content = frontmatter({ month: r.month, tags }) + r.markdown;
    files[`${ROOT}/Monthly Reflections/${r.month}.md`] = strToU8(content);
  }

  const passageNotes = await db.passageNotes.toArray();
  for (const note of passageNotes) {
    if (!note.markdown.trim()) continue;
    const encounter = await db.encounters.get(note.encounterId);
    if (!encounter) continue;
    const readingYear = await db.readingYears.get(encounter.readingYearId);
    const readingYearStartDate = readingYear ? localDateToISO(readingYear.startDate) : "unknown";
    const reference = getPlanDay(encounter.ordinal)?.streams[encounter.stream];
    if (!reference) continue;

    const tags = extractTags(note.markdown);
    const content =
      frontmatter({
        book: reference.book,
        reference: reference.display,
        stream: encounter.stream,
        ordinal: String(encounter.ordinal),
        readingYearId: encounter.readingYearId,
        readingYearStartDate,
        tags,
      }) + note.markdown;

    const filename = `${String(encounter.ordinal).padStart(3, "0")}-${slugify(reference.display)}.md`;
    const yearDirectory = readingYearDirectory(encounter.readingYearId, readingYearStartDate);
    files[
      `${ROOT}/Passage Notes/Reading Years/${yearDirectory}/${reference.book}/${filename}`
    ] = strToU8(content);
  }

  // Metadata: reading progress, per stream, in plain Markdown — not a
  // machine format, since this folder is meant to be human-readable
  // alongside the rest of the export.
  const readingYears = await db.readingYears.toArray();
  const metadataLines = [`# Reading Progress`, ""];
  for (const year of readingYears) {
    metadataLines.push(`## Reading year started ${year.startDate.year}-${String(year.startDate.month).padStart(2, "0")}-${String(year.startDate.day).padStart(2, "0")}`, "");
    const encounters = await db.encounters.where("readingYearId").equals(year.id).toArray();
    const completed = encounters.filter((e) => e.completedAt !== null);
    metadataLines.push(`- Total encounters recorded: ${encounters.length}`);
    metadataLines.push(`- Completed: ${completed.length}`, "");
  }
  files[`${ROOT}/Metadata/progress.md`] = strToU8(metadataLines.join("\n"));

  return zipSync(files, { level: 6 });
}

/**
 * The machine-readable backup: a raw dump of every table this app stores
 * locally. Independent of the Markdown export entirely — if ZIP generation
 * ever fails on some platform, this must still work, per the spec.
 */
export async function buildJsonBackup(): Promise<string> {
  const backup = {
    backupVersion: 1,
    exportedAt: new Date().toISOString(),
    readingYears: await db.readingYears.toArray(),
    streamShiftEvents: await db.streamShiftEvents.toArray(),
    encounters: await db.encounters.toArray(),
    passageNotes: await db.passageNotes.toArray(),
    dailyReflections: await db.dailyReflections.toArray(),
    monthlyReflections: await db.monthlyReflections.toArray(),
    tagReferences: await db.tagReferences.toArray(),
    settings: await db.settings.toArray(),
    appState: await db.appState.toArray(),
  };
  return JSON.stringify(backup, null, 2);
}

const BACKUP_TABLE_KEYS = [
  "readingYears",
  "streamShiftEvents",
  "encounters",
  "passageNotes",
  "dailyReflections",
  "monthlyReflections",
  "tagReferences",
  "settings",
  "appState",
] as const;

export interface ParsedBackup {
  backupVersion: number;
  exportedAt: string;
  readingYears: unknown[];
  streamShiftEvents: unknown[];
  encounters: unknown[];
  passageNotes: unknown[];
  dailyReflections: unknown[];
  monthlyReflections: unknown[];
  tagReferences: unknown[];
  settings: unknown[];
  appState: unknown[];
}

export class InvalidBackupError extends Error {}

/**
 * Parse and validate a JSON backup's shape before anything touches the
 * database. Deliberately fails loudly on anything unexpected rather than
 * silently importing a partial or malformed file — a bad restore should
 * never leave the app in a worse state than before the attempt.
 */
export function parseJsonBackup(json: string): ParsedBackup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new InvalidBackupError("That file isn't valid JSON.");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new InvalidBackupError("That file doesn't look like a backup.");
  }
  const obj = parsed as Record<string, unknown>;

  if (obj.backupVersion !== 1) {
    throw new InvalidBackupError(
      `Unrecognized backup version (${String(obj.backupVersion)}). This app only knows how to restore version 1 backups.`
    );
  }

  for (const key of BACKUP_TABLE_KEYS) {
    if (!Array.isArray(obj[key])) {
      throw new InvalidBackupError(`Backup is missing or has a malformed "${key}" section.`);
    }
  }

  return obj as unknown as ParsedBackup;
}

/**
 * Replace all local state with the contents of a backup — simple and
 * deterministic, per the spec, never attempting to merge with what's
 * already on the device. Runs as a single Dexie transaction so a failure
 * partway through can't leave the database in a mixed old/new state.
 */
export async function restoreFromJsonBackup(json: string): Promise<void> {
  const backup = parseJsonBackup(json); // validate BEFORE opening the transaction

  await db.transaction(
    "rw",
    [
      db.readingYears,
      db.streamShiftEvents,
      db.encounters,
      db.passageNotes,
      db.dailyReflections,
      db.monthlyReflections,
      db.tagReferences,
      db.settings,
      db.appState,
    ],
    async () => {
      await Promise.all([
        db.readingYears.clear(),
        db.streamShiftEvents.clear(),
        db.encounters.clear(),
        db.passageNotes.clear(),
        db.dailyReflections.clear(),
        db.monthlyReflections.clear(),
        db.tagReferences.clear(),
        db.settings.clear(),
        db.appState.clear(),
      ]);

      await Promise.all([
        db.readingYears.bulkAdd(backup.readingYears as never[]),
        db.streamShiftEvents.bulkAdd(backup.streamShiftEvents as never[]),
        db.encounters.bulkAdd(backup.encounters as never[]),
        db.passageNotes.bulkAdd(backup.passageNotes as never[]),
        db.dailyReflections.bulkAdd(backup.dailyReflections as never[]),
        db.monthlyReflections.bulkAdd(backup.monthlyReflections as never[]),
        db.tagReferences.bulkAdd(backup.tagReferences as never[]),
        db.settings.bulkAdd(backup.settings as never[]),
        db.appState.bulkAdd(backup.appState as never[]),
      ]);
    }
  );
}

export function downloadBlob(data: Uint8Array | string, filename: string, mimeType: string): void {
  const blob = new Blob([data as BlobPart], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
