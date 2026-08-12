import { describe, it, expect } from "vitest";
import { extractTags } from "../src/domain/tagParser";

describe("extractTags", () => {
  it("finds simple tags", () => {
    expect(extractTags("This connects to #prayer and #question")).toEqual(["prayer", "question"]);
  });

  it("allows letters, numbers, underscores, and hyphens after the first character", () => {
    expect(extractTags("#return-to-this #memorize_this #john3")).toEqual([
      "return-to-this",
      "memorize_this",
      "john3",
    ]);
  });

  it("allows a tag to start with a digit", () => {
    expect(extractTags("#1corinthians13")).toEqual(["1corinthians13"]);
  });

  it("does not match a bare # with nothing following", () => {
    expect(extractTags("just a # symbol")).toEqual([]);
  });

  it("does not match # immediately followed by punctuation or a hyphen", () => {
    expect(extractTags("#-notavalidtag and #_alsonot")).toEqual([]);
  });

  it("deduplicates repeated tags, keeping first-appearance order", () => {
    expect(extractTags("#prayer today. Later, #question. Then #prayer again.")).toEqual([
      "prayer",
      "question",
    ]);
  });

  it("ignores a heading marker (# Heading) since there's no valid tag character glued to it — but does match a genuine tag on its own line", () => {
    expect(extractTags("# Genealogy notes\n\nTagging this #genealogy")).toEqual(["genealogy"]);
  });

  it("ignores tags inside inline code spans", () => {
    expect(extractTags("Use `#notATag` in code, but #realTag outside")).toEqual(["realTag"]);
  });

  it("ignores tags inside fenced code blocks", () => {
    const markdown = [
      "Some text with #before",
      "```",
      "const x = '#notATag';",
      "```",
      "and #after",
    ].join("\n");
    expect(extractTags(markdown)).toEqual(["before", "after"]);
  });

  it("ignores tags inside a Markdown link's URL but still catches tags in the link text", () => {
    const markdown = "See [#linktext](https://example.com/#fragment-not-a-tag) for more.";
    expect(extractTags(markdown)).toEqual(["linktext"]);
  });

  it("ignores tags inside a bare autolink URL", () => {
    expect(extractTags("Reference <https://example.com/page#section> plus #realTag")).toEqual([
      "realTag",
    ]);
  });

  it("returns an empty array for markdown with no tags", () => {
    expect(extractTags("Just plain reflection text with no tags at all.")).toEqual([]);
  });

  it("handles tags adjacent to punctuation correctly", () => {
    expect(extractTags("Important (#question), really.")).toEqual(["question"]);
  });
});
