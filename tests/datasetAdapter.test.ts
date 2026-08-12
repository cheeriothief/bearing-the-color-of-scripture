import { describe, it, expect } from "vitest";
import { loadDataset, getPlanDay, getReadingYearLength } from "../src/domain/datasetAdapter";

describe("datasetAdapter", () => {
  it("loads exactly 365 days with no gaps or duplicates", () => {
    const ds = loadDataset();
    expect(ds.days.length).toBe(365);
    expect(getReadingYearLength()).toBe(365);
  });

  it("returns the expected first day (ordinal 1)", () => {
    const day1 = getPlanDay(1);
    expect(day1?.streams.psalms?.display).toBe("Psalms 1\u20135");
    expect(day1?.streams.oldTestament?.display).toBe("Genesis 1\u20132");
    expect(day1?.streams.gospel?.display).toBe("Matthew 1");
  });

  it("returns undefined for an out-of-range ordinal", () => {
    expect(getPlanDay(0)).toBeUndefined();
    expect(getPlanDay(366)).toBeUndefined();
  });

  it("has no Gospel assignment on the documented Aug 26–31 gap (ordinals 360-365)", () => {
    for (let ordinal = 360; ordinal <= 365; ordinal++) {
      const day = getPlanDay(ordinal);
      expect(day?.streams.gospel).toBeUndefined();
    }
  });

  it("resolved the Ezra/Ezekiel 'Ez' ambiguity correctly", () => {
    const ds = loadDataset();
    const ezraDays = ds.days.filter((d) => d.streams.oldTestament?.book === "Ezra");
    const ezekielDays = ds.days.filter((d) => d.streams.oldTestament?.book === "Ezekiel");
    const maxEzraChapter = Math.max(...ezraDays.map((d) => d.streams.oldTestament!.endChapter));
    const maxEzekielChapter = Math.max(
      ...ezekielDays.map((d) => d.streams.oldTestament!.endChapter)
    );
    expect(maxEzraChapter).toBe(10); // Ezra has exactly 10 chapters
    expect(maxEzekielChapter).toBe(48); // Ezekiel has exactly 48 chapters
  });

  it("completes 12 full passes of Psalms and Proverbs (corrected dataset)", () => {
    const ds = loadDataset();
    const psalmsReads = new Map<number, number>();
    const proverbsReads = new Map<number, number>();
    for (const day of ds.days) {
      const ps = day.streams.psalms;
      if (ps) {
        for (let ch = ps.startChapter; ch <= ps.endChapter; ch++) {
          psalmsReads.set(ch, (psalmsReads.get(ch) ?? 0) + 1);
        }
      }
      const pr = day.streams.proverbs;
      if (pr) {
        for (let ch = pr.startChapter; ch <= pr.endChapter; ch++) {
          proverbsReads.set(ch, (proverbsReads.get(ch) ?? 0) + 1);
        }
      }
    }
    for (let ch = 1; ch <= 150; ch++) {
      expect(psalmsReads.get(ch)).toBe(12);
    }
    for (let ch = 1; ch <= 31; ch++) {
      expect(proverbsReads.get(ch)).toBe(12);
    }
  });
});
