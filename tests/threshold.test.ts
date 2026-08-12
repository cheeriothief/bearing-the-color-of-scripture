import { describe, it, expect } from "vitest";
import { shouldShowThreshold } from "../src/domain/threshold";
import type { LocalDate } from "../src/services/clock";

const today: LocalDate = { year: 2026, month: 9, day: 5 };

describe("shouldShowThreshold", () => {
  it("shows on the very first launch (never shown before)", () => {
    expect(shouldShowThreshold(null, today)).toBe(true);
  });

  it("does not show again the same day it was already shown", () => {
    expect(shouldShowThreshold("2026-09-05", today)).toBe(false);
  });

  it("shows again on a new calendar day", () => {
    expect(shouldShowThreshold("2026-09-04", today)).toBe(true);
  });

  it("shows again even if the last shown date is oddly in the future (defensive)", () => {
    expect(shouldShowThreshold("2026-09-06", today)).toBe(true);
  });
});
