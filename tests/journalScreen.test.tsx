import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import Journal from "../src/routes/Journal";
import db from "../src/services/database";

beforeEach(async () => {
  await db.dailyReflections.clear();
  await db.monthlyReflections.clear();
});

describe("Journal reflection controls", () => {
  it("opens reflection editors with mouse and standard keyboard activation", () => {
    render(<Journal />);

    fireEvent.click(screen.getByRole("button", { name: "Edit Daily Reflection" }));
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    const monthlyReflection = screen.getByRole("button", {
      name: "Edit Monthly Reflection",
    });
    fireEvent.keyDown(monthlyReflection, { key: " " });
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
  });
});
