import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import Read from "../src/routes/Read";
import db from "../src/services/database";

beforeEach(async () => {
  await db.readingYears.clear();
  await db.streamShiftEvents.clear();
  await db.encounters.clear();
  await db.passageNotes.clear();
  await db.settings.clear();
});

describe("Read screen (smoke test)", () => {
  it("boots, creates a reading year, and shows today's readings", async () => {
    render(<Read />);

    expect(await screen.findByText("Reading Desk")).toBeInTheDocument();

    // At least one stream row should render once data loads, regardless of
    // which session (Morning/Evening) the current time of day defaults to.
    await waitFor(async () => {
      const completeButtons = await screen.findAllByRole("button", { name: "Mark complete" });
      expect(completeButtons.length).toBeGreaterThan(0);
    });

    // Exactly one reading year should have been bootstrapped.
    const years = await db.readingYears.toArray();
    expect(years).toHaveLength(1);
  });

  it("marking a reading complete updates the UI and persists to the database", async () => {
    render(<Read />);
    await screen.findByText("Reading Desk");

    // "Mark complete" appears twice per row (the swipe-hint overlay text and
    // the real button) — target the button specifically by role.
    const completeButtons = await screen.findAllByRole("button", { name: "Mark complete" });
    expect(completeButtons.length).toBeGreaterThan(0);

    fireEvent.click(completeButtons[0]);

    await waitFor(async () => {
      const encounters = await db.encounters.toArray();
      expect(encounters.some((e) => e.completedAt !== null)).toBe(true);
    });

    expect(await screen.findAllByRole("button", { name: "Mark incomplete" })).not.toHaveLength(0);
  });
});
