import db from "./database";
import { extractTags } from "../domain/tagParser";

export type TagSourceType = "passageNote" | "dailyReflection" | "monthlyReflection";

/**
 * Regenerate the tag index for one source (a passage note, daily
 * reflection, or monthly reflection). Tags are described in the spec as
 * "regenerable" — this is the one function responsible for that: delete
 * whatever tag rows currently point at this source, then insert fresh ones
 * parsed from the given markdown. Always call this after saving markdown
 * content, never separately.
 */
export async function reindexTags(
  sourceType: TagSourceType,
  sourceId: string,
  markdown: string
): Promise<void> {
  const existing = await db.tagReferences
    .where("sourceId")
    .equals(sourceId)
    .and((row) => row.sourceType === sourceType)
    .toArray();
  if (existing.length > 0) {
    await db.tagReferences.bulkDelete(existing.map((row) => row.id));
  }

  const tags = extractTags(markdown);
  if (tags.length === 0) return;

  const now = new Date().toISOString();
  await db.tagReferences.bulkAdd(
    tags.map((tag) => ({
      id: crypto.randomUUID(),
      tag,
      sourceType,
      sourceId,
      createdAt: now,
    }))
  );
}

export async function findByTag(tag: string) {
  return db.tagReferences.where("tag").equals(tag).toArray();
}

export async function listAllTags(): Promise<string[]> {
  const rows = await db.tagReferences.toArray();
  return [...new Set(rows.map((r) => r.tag))].sort();
}
