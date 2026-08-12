import { marked } from "marked";
import DOMPurify from "dompurify";

/**
 * Parse Markdown to sanitized HTML. This is the single choke point for
 * rendering user-authored Markdown anywhere in the app — passage notes,
 * Daily Reflections, Monthly Reflections. Embedded HTML or script tags in
 * the source are stripped by DOMPurify before the result is ever used,
 * satisfying the spec's "rendered Markdown must be sanitized" requirement
 * regardless of which screen is doing the rendering.
 */
export function renderMarkdownSafe(markdown: string): string {
  const rawHtml = marked.parse(markdown, { async: false, gfm: true, breaks: true }) as string;
  return DOMPurify.sanitize(rawHtml);
}
