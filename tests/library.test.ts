import { describe, it, expect, beforeEach } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import db from "../src/services/database";
import { toggleCompletion, savePassageNote } from "../src/services/encounterActions";
import { saveDailyReflection, saveMonthlyReflection } from "../src/services/reflectionRepo";
import { getScriptureNotesByBook } from "../src/services/scriptureNotesRepo";
import { getStreamProgress, getRepeatedPassages } from "../src/services/progressRepo";
import { buildJsonBackup, buildMarkdownExportZip } from "../src/services/exportService";
import { compareBookOrder, BIBLE_BOOK_ORDER } from "../src/domain/bibleBooks";
import type { LocalDate } from "../src/services/clock";

const sep1: LocalDate = { year: 2026, month: 9, day: 1 };

beforeEach(async () => {
  await db.readingYears.clear();
  await db.encounters.clear();
  await db.passageNotes.clear();
  await db.dailyReflections.clear();
  await db.monthlyReflections.clear();
  await db.tagReferences.clear();
});

describe("bibleBooks", () => {
  it("orders books canonically, Genesis before Revelation", () => {
    expect(compareBookOrder("Genesis", "Revelation")).toBeLessThan(0);
    expect(compareBookOrder("Matthew", "Genesis")).toBeGreaterThan(0);
  });

  it("contains exactly 66 books with no duplicates", () => {
    expect(BIBLE_BOOK_ORDER.length).toBe(66);
    expect(new Set(BIBLE_BOOK_ORDER).size).toBe(66);
  });
});

describe("scriptureNotesRepo", () => {
  it("groups notes by book in canonical order, not alphabetical or write order", async () => {
    // Write a Matthew (gospel, ordinal 1) note before a Genesis (OT, ordinal 1) note.
    const gospelEnc = await toggleCompletion("year-1", "gospel", 1);
    await savePassageNote(gospelEnc.id, "Matthew note.");
    const otEnc = await toggleCompletion("year-1", "oldTestament", 1);
    await savePassageNote(otEnc.id, "Genesis note.");

    const groups = await getScriptureNotesByBook();
    const books = groups.map((g) => g.book);
    expect(books.indexOf("Genesis")).toBeLessThan(books.indexOf("Matthew"));
  });

  it("excludes notes that have been emptied out", async () => {
    const enc = await toggleCompletion("year-1", "psalms", 1);
    await savePassageNote(enc.id, "something");
    await savePassageNote(enc.id, "   "); // cleared to whitespace
    const groups = await getScriptureNotesByBook();
    expect(groups.find((g) => g.book === "Psalms")).toBeUndefined();
  });
});

describe("progressRepo", () => {
  it("counts completed readings per stream without inflating from other reading years", async () => {
    await toggleCompletion("year-1", "gospel", 1);
    await toggleCompletion("year-1", "gospel", 2);
    await toggleCompletion("year-2", "gospel", 3); // different reading year

    const progress = await getStreamProgress("year-1");
    const gospel = progress.find((p) => p.stream === "gospel")!;
    expect(gospel.completedCount).toBe(2);
  });

  it("lists books encountered based on completed readings", async () => {
    await toggleCompletion("year-1", "oldTestament", 1); // Genesis 1-2
    const progress = await getStreamProgress("year-1");
    const ot = progress.find((p) => p.stream === "oldTestament")!;
    expect(ot.booksEncountered).toContain("Genesis");
  });

  it("does not count an un-completed (merely noted) reading toward completedCount", async () => {
    const enc = await toggleCompletion("year-1", "psalms", 1);
    await toggleCompletion("year-1", "psalms", 1); // toggled back off
    await savePassageNote(enc.id, "a note without completing it");
    const progress = await getStreamProgress("year-1");
    const psalms = progress.find((p) => p.stream === "psalms")!;
    expect(psalms.completedCount).toBe(0);
  });

  it("identifies a passage engaged with more than once as a repeated encounter", async () => {
    // Matthew 1 occurs at ordinal 1 and again at ordinal 114 (Christmas swap).
    await toggleCompletion("year-1", "gospel", 1);
    await toggleCompletion("year-1", "gospel", 114);
    const repeated = await getRepeatedPassages("year-1");
    const matthew1 = repeated.find((r) => r.book === "Matthew" && r.startChapter === 1);
    expect(matthew1?.encounterCount).toBe(2);
  });

  it("does not list a passage encountered only once as repeated", async () => {
    await toggleCompletion("year-1", "psalms", 1);
    const repeated = await getRepeatedPassages("year-1");
    expect(repeated).toHaveLength(0);
  });
});

describe("exportService — JSON backup", () => {
  it("includes every table, and is valid JSON", async () => {
    await toggleCompletion("year-1", "psalms", 1);
    await saveDailyReflection(sep1, "Today's thoughts.");

    const json = await buildJsonBackup();
    const parsed = JSON.parse(json);
    expect(parsed.encounters.length).toBeGreaterThan(0);
    expect(parsed.dailyReflections.length).toBeGreaterThan(0);
    expect(parsed.backupVersion).toBe(1);
  });
});

describe("exportService — Markdown ZIP", () => {
  it("produces a real ZIP with the expected folder structure", async () => {
    await saveDailyReflection(sep1, "Daily thoughts with a #tag.");
    await saveMonthlyReflection(sep1, "Monthly summary.");
    const enc = await toggleCompletion("year-1", "oldTestament", 1); // Genesis 1-2
    await savePassageNote(enc.id, "A note on Genesis.");

    const zipBytes = await buildMarkdownExportZip();
    const files = unzipSync(zipBytes);
    const paths = Object.keys(files);

    expect(paths.some((p) => p.startsWith("Bearing the Color of Scripture/Journal/"))).toBe(true);
    expect(
      paths.some((p) => p.startsWith("Bearing the Color of Scripture/Monthly Reflections/"))
    ).toBe(true);
    expect(
      paths.some((p) => p.startsWith("Bearing the Color of Scripture/Passage Notes/Genesis/"))
    ).toBe(true);
    expect(paths).toContain("Bearing the Color of Scripture/Metadata/progress.md");
  });

  it("includes tag frontmatter derived from the note's own content", async () => {
    await saveDailyReflection(sep1, "Reflecting on #gratitude today.");
    const zipBytes = await buildMarkdownExportZip();
    const files = unzipSync(zipBytes);
    const dailyFile = Object.entries(files).find(([path]) =>
      path.startsWith("Bearing the Color of Scripture/Journal/")
    );
    expect(dailyFile).toBeDefined();
    const content = strFromU8(dailyFile![1]);
    expect(content).toContain("gratitude");
    expect(content).toContain("---"); // frontmatter delimiter
  });

  it("skips empty reflections and notes entirely rather than exporting blank files", async () => {
    await saveDailyReflection(sep1, "   "); // whitespace only
    const zipBytes = await buildMarkdownExportZip();
    const files = unzipSync(zipBytes);
    const journalFiles = Object.keys(files).filter((p) =>
      p.startsWith("Bearing the Color of Scripture/Journal/")
    );
    expect(journalFiles).toHaveLength(0);
  });
});
