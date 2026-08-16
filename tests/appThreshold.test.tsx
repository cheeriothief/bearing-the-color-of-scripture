import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App";
import db from "../src/services/database";

beforeEach(async () => {
  await db.readingYears.clear();
  await db.streamShiftEvents.clear();
  await db.encounters.clear();
  await db.settings.clear();
  await db.appState.clear();
});

describe("App — Threshold gate", () => {
  it("shows Threshold (with a prayer and an Enter button) on first launch, not the primary nav", async () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );

    const enterButton = await screen.findByRole("button", { name: "Enter" });
    expect(enterButton).toBeInTheDocument();
    // Primary nav shouldn't be reachable yet — Threshold is a full gate.
    expect(screen.queryByLabelText("Primary")).not.toBeInTheDocument();
  });

  it("entering reveals the primary nav and does not show Threshold again", async () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );

    const enterButton = await screen.findByRole("button", { name: "Enter" });
    fireEvent.click(enterButton);

    await waitFor(() => {
      expect(screen.getByLabelText("Primary")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "Enter" })).not.toBeInTheDocument();

    // A row was written recording today as shown.
    const stateRow = await db.appState.get("lastThresholdShownDate");
    expect(stateRow?.value).toBeTruthy();
  });

  it("does not show Threshold on a second app render the same day, once already entered", async () => {
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
      today.getDate()
    ).padStart(2, "0")}`;
    await db.appState.put({ key: "lastThresholdShownDate", value: iso });

    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Primary")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "Enter" })).not.toBeInTheDocument();
  });

  it("removes the application header chrome from the Reading Desk only", async () => {
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
      today.getDate()
    ).padStart(2, "0")}`;
    await db.appState.put({ key: "lastThresholdShownDate", value: iso });

    const view = render(
      <MemoryRouter initialEntries={["/read"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Reading Desk" })).toBeInTheDocument();
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();

    view.unmount();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    );
    expect(await screen.findByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
  });
});
