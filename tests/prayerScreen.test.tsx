import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Prayer from "../src/routes/Prayer";
import { PRAYER_BOOK } from "../src/domain/prayerBook";

describe("Prayer screen", () => {
  it("renders the prayer book in its source order with semantic headings and provenance", () => {
    render(<Prayer />);

    expect(screen.getByRole("heading", { level: 1, name: "Prayer Book" })).toBeInTheDocument();
    const entries = document.querySelectorAll("article.prayer-entry");
    expect(entries).toHaveLength(PRAYER_BOOK.length);

    PRAYER_BOOK.forEach((prayer, index) => {
      const entry = within(entries[index] as HTMLElement);
      expect(entry.getByRole("heading", { level: 2, name: prayer.title })).toBeInTheDocument();
      expect(entry.getByText(prayer.attribution)).toBeInTheDocument();
      expect(entry.getByText(prayer.text)).toBeInTheDocument();
    });
  });
});
