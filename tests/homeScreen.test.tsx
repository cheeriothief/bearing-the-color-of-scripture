import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App";
import db from "../src/services/database";

async function passThreshold() {
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  await db.appState.put({ key: "lastThresholdShownDate", value: iso });
}

beforeEach(async () => {
  await db.readingYears.clear();
  await db.streamShiftEvents.clear();
  await db.encounters.clear();
  await db.settings.clear();
  await db.appState.clear();
  document.documentElement.removeAttribute("data-theme");
  await passThreshold();
});

describe("Home screen", () => {
  it("presents the status-driven prayer-book cover and accessible destinations", async () => {
    render(<MemoryRouter><App /></MemoryRouter>);

    expect(await screen.findByRole("heading", { name: "Bearing the Color of Scripture" })).toBeInTheDocument();
    expect(await screen.findByText("Morning and evening readings remain.")).toBeInTheDocument();
    expect(screen.getByTestId("prayer-book-cover")).toHaveAttribute("aria-labelledby", "home-title");

    const destinations = screen.getByRole("navigation", { name: "Home destinations" });
    const expected = [
      ["Read", "/read"],
      ["Journal", "/journal"],
      ["Prayer", "/prayer"],
      ["Library", "/library"],
      ["Settings", "/settings"],
    ];
    for (const [name, href] of expected) {
      expect(destinations.querySelector(`a[href="${href}"]`)).toHaveAccessibleName(name);
    }

    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toHaveClass("active");
    await waitFor(() => expect(document.documentElement).toHaveAttribute("data-theme", "prayerbook"));
  });

  it.each(["candlelight", "minimal"])("keeps the %s Home usable", async (theme) => {
    await db.settings.put({ key: "theme", value: theme });
    render(<MemoryRouter><App /></MemoryRouter>);

    expect(await screen.findByRole("heading", { name: "Bearing the Color of Scripture" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Home destinations" })).toBeInTheDocument();
    await waitFor(() => expect(document.documentElement).toHaveAttribute("data-theme", theme));
  });

  it("navigates to Settings and keeps theme switching functional", async () => {
    render(<MemoryRouter><App /></MemoryRouter>);
    await screen.findByText("Morning and evening readings remain.");
    const destinations = await screen.findByRole("navigation", { name: "Home destinations" });
    fireEvent.click(within(destinations).getByRole("link", { name: "Settings" }));

    const minimal = await screen.findByRole("radio", { name: /Minimal/ });
    fireEvent.click(minimal);
    await waitFor(() => expect(document.documentElement).toHaveAttribute("data-theme", "minimal"));
  });
});
