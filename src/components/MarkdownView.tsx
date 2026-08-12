import { useMemo } from "react";
import { renderMarkdownSafe } from "../domain/markdown";

/**
 * Renders Markdown as sanitized HTML. Every note and reflection display in
 * the app goes through this component (which delegates the actual
 * parsing/sanitizing to domain/markdown.ts, so that logic stays testable
 * without needing to mount React).
 */
export default function MarkdownView({ markdown }: { markdown: string }) {
  const html = useMemo(() => renderMarkdownSafe(markdown), [markdown]);

  if (!markdown.trim()) {
    return null;
  }

  // eslint-disable-next-line react/no-danger -- html is sanitized in renderMarkdownSafe
  return <div className="markdown-view" dangerouslySetInnerHTML={{ __html: html }} />;
}
