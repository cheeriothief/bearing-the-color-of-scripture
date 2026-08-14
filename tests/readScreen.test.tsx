import { describe, it, expect, beforeEach } from "vitest";
import { act, render, screen, waitFor, fireEvent } from "@testing-library/react";
import Read from "../src/routes/Read";
import db, { getOrCreateEncounter } from "../src/services/database";
import {
  countEngagedEncounters,
  savePassageNote,
} from "../src/services/encounterActions";
import { hasActivity } from "../src/services/readingYearRepo";

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

  it("does not create an encounter or activity for the default visible notebook", async () => {
    render(<Read />);
    await screen.findByText("Reading Desk");
    await screen.findAllByRole("button", { name: "Mark complete" });

    await waitFor(async () => expect(await db.readingYears.count()).toBe(1));
    const year = (await db.readingYears.toArray())[0];
    expect(await db.encounters.count()).toBe(0);
    expect(await hasActivity(year.id)).toBe(false);
    expect(await countEngagedEncounters(year.id, "gospel", [1])).toBe(0);
  });

  it("selecting another reading and opening its notebook remains passive", async () => {
    render(<Read />);
    await screen.findByText("Reading Desk");
    const completeButtons = await screen.findAllByRole("button", { name: "Mark complete" });
    expect(completeButtons.length).toBeGreaterThan(1);

    fireEvent.click(completeButtons[1].closest(".reading-row")!);

    await waitFor(() => expect(screen.getByRole("textbox")).toBeEnabled());
    expect(await db.encounters.count()).toBe(0);
  });

  it("saving meaningful note content creates an encounter", async () => {
    render(<Read />);
    await screen.findByText("Reading Desk");
    const textarea = await screen.findByRole("textbox");

    fireEvent.change(textarea, { target: { value: "A meaningful note" } });
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));

    await waitFor(async () => expect(await db.encounters.count()).toBe(1));
    expect(await db.passageNotes.count()).toBe(1);
  });

  it("opens and displays an existing encounter note without creating another encounter", async () => {
    const firstRender = render(<Read />);
    await screen.findByText("Reading Desk");
    await waitFor(async () => expect(await db.readingYears.count()).toBe(1));
    const year = (await db.readingYears.toArray())[0];
    const firstButton = (await screen.findAllByRole("button", { name: "Mark complete" }))[0];
    const row = firstButton.closest(".reading-row")!;
    const streamLabel = row.querySelector(".reading-row__stream")!.textContent;
    const streamByLabel = {
      Psalms: "psalms",
      Proverbs: "proverbs",
      "Old Testament": "oldTestament",
      Gospel: "gospel",
      "New Testament": "newTestament",
    } as const;
    const stream = streamByLabel[streamLabel as keyof typeof streamByLabel];
    await act(async () => {
      const encounter = await getOrCreateEncounter(year.id, stream, 1);
      await savePassageNote(encounter.id, "Existing **note**");
    });

    firstRender.unmount();
    render(<Read />);

    expect(await screen.findByText("note", { selector: "strong" })).toBeInTheDocument();
    expect(await db.encounters.count()).toBe(1);
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
