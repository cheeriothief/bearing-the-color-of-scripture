import { strToU8, zipSync } from "fflate";
import db from "./database";
import { getPlanDay } from "../domain/datasetAdapter";
import { extractTags } from "../domain/tagParser";

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
    const reference = getPlanDay(encounter.ordinal)?.streams[encounter.stream];
    if (!reference) continue;

    const tags = extractTags(note.markdown);
    const content =
      frontmatter({
        book: reference.book,
        reference: reference.display,
        stream: encounter.stream,
        ordinal: String(encounter.ordinal),
        tags,
      }) + note.markdown;

    const filename = `${String(encounter.ordinal).padStart(3, "0")}-${slugify(reference.display)}.md`;
    files[`${ROOT}/Passage Notes/${reference.book}/${filename}`] = strToU8(content);
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
  };
  return JSON.stringify(backup, null, 2);
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
