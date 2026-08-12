/**
 * Extracts #tags from raw Markdown per the spec's grammar: a tag begins
 * with `#` immediately followed by a letter or number, and may then
 * contain letters, numbers, underscores, or hyphens. Tags inside inline
 * code spans, fenced code blocks, or link URLs are ignored — otherwise a
 * heading like "# Genealogy" or a URL fragment would pollute the tag index.
 *
 * This operates on raw Markdown text, not rendered HTML, and is
 * intentionally independent of the Markdown renderer — tag indexing should
 * keep working even if the rendering library changes.
 */

const TAG_PATTERN = /#([A-Za-z0-9][A-Za-z0-9_-]*)/g;

/**
 * Strip regions of the source that must never contribute tags:
 * fenced code blocks (```...```), inline code spans (`...`), and the URL
 * portion of Markdown links ([text](url)) and bare autolinks (<url>).
 * Replaced with matching-length whitespace so character offsets stay
 * stable, in case a caller ever wants them.
 */
function blankExcludedRegions(markdown: string): string {
  let result = markdown;

  // Fenced code blocks: ```...``` (non-greedy, across lines)
  result = result.replace(/```[\s\S]*?```/g, (m) => " ".repeat(m.length));

  // Inline code spans: `...`
  result = result.replace(/`[^`\n]*`/g, (m) => " ".repeat(m.length));

  // Markdown link URLs: only the (url) part, so [#tag](url) still indexes
  // "#tag" from the link text while ignoring the destination.
  result = result.replace(/\]\(([^)]*)\)/g, (_m, url) => "](" + " ".repeat(url.length) + ")");

  // Bare autolinks: <https://example.com/#fragment>
  result = result.replace(/<([^>\s]+:\/\/[^>]*)>/g, (_m, url) => "<" + " ".repeat(url.length) + ">");

  return result;
}

/** Returns unique tags found in the given Markdown, without the leading #, deduplicated, order of first appearance. */
export function extractTags(markdown: string): string[] {
  const cleaned = blankExcludedRegions(markdown);
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const match of cleaned.matchAll(TAG_PATTERN)) {
    const tag = match[1];
    if (!seen.has(tag)) {
      seen.add(tag);
      ordered.push(tag);
    }
  }
  return ordered;
}
