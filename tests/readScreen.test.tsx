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
      const completeButtons = await screen.findAllByRole("button", { name: /^Mark complete:/ });
      expect(completeButtons.length).toBeGreaterThan(0);
    });
    // The default notebook performs a second asynchronous load after the rows
    // appear. Await it so the test does not finish while React is still
    // applying that state update.
    expect(await screen.findByText("No note yet.")).toBeInTheDocument();

    // Exactly one reading year should have been bootstrapped.
    const years = await db.readingYears.toArray();
    expect(years).toHaveLength(1);
  });

  it("does not create an encounter or activity for the default visible notebook", async () => {
    render(<Read />);
    await screen.findByText("Reading Desk");
    await screen.findAllByRole("button", { name: /^Mark complete:/ });

    await waitFor(async () => expect(await db.readingYears.count()).toBe(1));
    const year = (await db.readingYears.toArray())[0];
    expect(await db.encounters.count()).toBe(0);
    expect(await hasActivity(year.id)).toBe(false);
    expect(await countEngagedEncounters(year.id, "gospel", [1])).toBe(0);
  });

  it("selects another reading by pointer without toggling completion or creating activity", async () => {
    render(<Read />);
    await screen.findByText("Reading Desk");
    const completeButtons = await screen.findAllByRole("button", { name: /^Mark complete:/ });
    expect(completeButtons.length).toBeGreaterThan(1);

    const secondRow = completeButtons[1].closest(".reading-row")!;
    const selection = secondRow.querySelector<HTMLButtonElement>(".reading-row__selection")!;
    fireEvent.click(selection);

    await waitFor(() => expect(screen.getByText("No note yet.")).toBeInTheDocument());
    expect(await db.encounters.count()).toBe(0);
    expect(completeButtons[1]).toHaveAccessibleName(/^Mark complete:/);
  });

  it("selects different readings with native keyboard activation without toggling completion", async () => {
    render(<Read />);
    const selectionButtons = await screen.findAllByRole("button", { name: /Open notebook for/ });
    expect(selectionButtons.length).toBeGreaterThan(1);

    selectionButtons[1].focus();
    fireEvent.keyDown(selectionButtons[1], { key: "Enter" });
    fireEvent.click(selectionButtons[1]);

    const reference = selectionButtons[1].querySelector(".reading-row__ref")!.textContent!;
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: reference })).toBeInTheDocument();
    });
    expect(await db.encounters.count()).toBe(0);
    expect(screen.getAllByRole("button", { name: /^Mark complete:/ })).toHaveLength(
      selectionButtons.length
    );
  });

  it("saving meaningful note content creates an encounter", async () => {
    render(<Read />);
    await screen.findByText("Reading Desk");
    await screen.findByText("No note yet.");
    fireEvent.click(screen.getByRole("button", { name: "Write a note" }));
    const textarea = await screen.findByRole("textbox", { name: /Note for/ });

    fireEvent.change(textarea, { target: { value: "A meaningful note" } });
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));

    await waitFor(async () => expect(await db.encounters.count()).toBe(1));
    expect(await db.passageNotes.count()).toBe(1);
    expect(await screen.findByText("A meaningful note")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /Note for/ })).not.toBeInTheDocument();
  });

  it("keeps the empty state persistence-free and cancel discards a draft", async () => {
    render(<Read />);
    expect(await screen.findByText("No note yet.")).toBeInTheDocument();
    expect(await db.encounters.count()).toBe(0);

    fireEvent.click(screen.getByRole("button", { name: "Write a note" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Note for/ }), {
      target: { value: "Unsaved thought" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByText("No note yet.")).toBeInTheDocument();
    expect(await db.encounters.count()).toBe(0);
  });

  it("does not persist a whitespace-only note", async () => {
    render(<Read />);
    await screen.findByText("No note yet.");
    fireEvent.click(screen.getByRole("button", { name: "Write a note" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Note for/ }), {
      target: { value: "   \n" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));

    await waitFor(async () => expect(await db.encounters.count()).toBe(0));
    expect(await db.passageNotes.count()).toBe(0);
  });

  it("opens and displays an existing encounter note without creating another encounter", async () => {
    const firstRender = render(<Read />);
    await screen.findByText("Reading Desk");
    await waitFor(async () => expect(await db.readingYears.count()).toBe(1));
    const year = (await db.readingYears.toArray())[0];
    const firstButton = (await screen.findAllByRole("button", { name: /^Mark complete:/ }))[0];
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
    // Finish and tear down the bootstrap render before seeding the existing
    // note. Writing while its one-time Notebook load was in flight made this
    // setup race whether that load observed the note.
    await screen.findByText("No note yet.");
    firstRender.unmount();
    await act(async () => {
      const encounter = await getOrCreateEncounter(year.id, stream, 1);
      await savePassageNote(encounter.id, "Existing **note**");
    });
    render(<Read />);

    expect(await screen.findByText("note", { selector: "strong" })).toBeInTheDocument();
    expect(await db.encounters.count()).toBe(1);
  });

  it("opens an existing note for editing with mouse and keyboard activation", async () => {
    const firstRender = render(<Read />);
    await screen.findByText("Reading Desk");
    await screen.findByText("No note yet.");
    const year = (await db.readingYears.toArray())[0];
    const firstButton = (await screen.findAllByRole("button", { name: /^Mark complete:/ }))[0];
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
      await savePassageNote(encounter.id, "Existing note");
    });
    firstRender.unmount();

    render(<Read />);
    const noteControl = await screen.findByRole("button", { name: "Edit note" });
    noteControl.focus();
    fireEvent.keyDown(noteControl, { key: "Enter" });
    fireEvent.click(noteControl);
    expect(await screen.findByRole("textbox", { name: /Note for/ })).toHaveValue("Existing note");

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    const reopenedControl = await screen.findByRole("button", { name: "Edit note" });
    fireEvent.click(reopenedControl);
    expect(await screen.findByRole("textbox", { name: /Note for/ })).toHaveValue("Existing note");
  });

  it("marking a reading complete updates the UI and persists to the database", async () => {
    render(<Read />);
    await screen.findByText("Reading Desk");

    // "Mark complete" appears twice per row (the swipe-hint overlay text and
    // the real button) — target the button specifically by role.
    const completeButtons = await screen.findAllByRole("button", { name: /^Mark complete:/ });
    expect(completeButtons.length).toBeGreaterThan(0);

    fireEvent.click(completeButtons[0]);

    await waitFor(async () => {
      const encounters = await db.encounters.toArray();
      expect(encounters.some((e) => e.completedAt !== null)).toBe(true);
    });

    expect(await screen.findAllByRole("button", { name: /^Mark incomplete:/ })).not.toHaveLength(0);
  });
});
