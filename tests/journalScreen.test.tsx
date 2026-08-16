import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import Journal from "../src/routes/Journal";
import db from "../src/services/database";

beforeEach(async () => {
  await db.dailyReflections.clear();
  await db.monthlyReflections.clear();
});

describe("Journal reflection controls", () => {
  it("opens explicitly named reflection editors with mouse and standard keyboard activation", () => {
    render(<Journal />);

    fireEvent.click(screen.getByRole("button", { name: "Edit Daily Reflection" }));
    expect(screen.getByRole("textbox", { name: /Daily Reflection for/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    const monthlyReflection = screen.getByRole("button", {
      name: "Edit Monthly Reflection",
    });
    fireEvent.keyDown(monthlyReflection, { key: " " });
    expect(screen.getByRole("textbox", { name: /Monthly Reflection for/ })).toBeInTheDocument();
  });

  it("keeps reflection editing and saving functional", async () => {
    render(<Journal />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Daily Reflection" }));
    const input = screen.getByRole("textbox", { name: /Daily Reflection for/ });
    fireEvent.change(input, { target: { value: "A daily reflection" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Edit Daily Reflection" })).toBeInTheDocument();
      expect(screen.getByText("A daily reflection")).toBeInTheDocument();
    });
  });
});
