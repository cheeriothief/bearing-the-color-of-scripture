import { describe, it, expect } from "vitest";
import { renderMarkdownSafe } from "../src/domain/markdown";

describe("renderMarkdownSafe", () => {
  it("renders basic Markdown formatting", () => {
    const html = renderMarkdownSafe("**bold** and *italic* and a [link](https://example.com)");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
    expect(html).toContain('href="https://example.com"');
  });

  it("renders headings, lists, and blockquotes", () => {
    const html = renderMarkdownSafe("# Heading\n\n- one\n- two\n\n> a quote");
    expect(html).toContain("<h1>Heading</h1>");
    expect(html).toContain("<li>one</li>");
    expect(html).toContain("<blockquote>");
  });

  it("strips a raw <script> tag entirely", () => {
    const html = renderMarkdownSafe("Some notes.\n\n<script>alert('xss')</script>\n\nMore notes.");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("alert(");
  });

  it("strips inline event handler attributes like onerror", () => {
    const html = renderMarkdownSafe('<img src="x" onerror="alert(1)">');
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("alert(1)");
  });

  it("strips a javascript: URL in a link", () => {
    const html = renderMarkdownSafe("[click me](javascript:alert(1))");
    expect(html.toLowerCase()).not.toContain("javascript:");
  });

  it("strips an iframe embed", () => {
    const html = renderMarkdownSafe('<iframe src="https://evil.example.com"></iframe>');
    expect(html).not.toContain("<iframe");
  });

  it("returns empty-ish output for empty input without throwing", () => {
    expect(() => renderMarkdownSafe("")).not.toThrow();
  });

  it("leaves a literal # tag alone as plain text (tag rendering is a display concern, not a markdown one)", () => {
    const html = renderMarkdownSafe("Tagging this #prayer for later.");
    expect(html).toContain("#prayer");
  });
});
