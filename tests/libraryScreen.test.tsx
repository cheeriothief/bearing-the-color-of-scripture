import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Library from "../src/routes/Library";

describe("Library section tabs", () => {
  it("selects sections by click and exposes the associated panel", async () => {
    render(<Library />);

    const exportTab = screen.getByRole("tab", { name: "Export" });
    fireEvent.click(exportTab);

    expect(exportTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Export");
    expect(screen.getByRole("button", { name: /Export as Markdown/ })).toBeInTheDocument();
  });

  it("supports arrow, Home, and End keyboard tab navigation", () => {
    render(<Library />);

    const notesTab = screen.getByRole("tab", { name: "Scripture Notes" });
    fireEvent.keyDown(notesTab, { key: "ArrowRight" });
    const tagsTab = screen.getByRole("tab", { name: "Tags" });
    expect(tagsTab).toHaveFocus();
    expect(tagsTab).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(tagsTab, { key: "End" });
    const exportTab = screen.getByRole("tab", { name: "Export" });
    expect(exportTab).toHaveFocus();
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Export");

    fireEvent.keyDown(exportTab, { key: "Home" });
    expect(notesTab).toHaveFocus();
    expect(notesTab).toHaveAttribute("aria-selected", "true");
  });
});
