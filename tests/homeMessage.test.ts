import { describe, it, expect } from "vitest";
import { remainingSessionsMessage } from "../src/domain/homeMessage";

describe("remainingSessionsMessage", () => {
  it("returns null when there are no readings at all today", () => {
    expect(remainingSessionsMessage([])).toBeNull();
  });

  it("returns null when everything today is already complete", () => {
    expect(
      remainingSessionsMessage([
        { session: "morning", completed: true },
        { session: "evening", completed: true },
      ])
    ).toBeNull();
  });

  it("mentions only evening when morning is done but evening isn't", () => {
    expect(
      remainingSessionsMessage([
        { session: "morning", completed: true },
        { session: "evening", completed: false },
      ])
    ).toBe("Evening readings remain.");
  });

  it("mentions only morning when evening is done but morning isn't", () => {
    expect(
      remainingSessionsMessage([
        { session: "morning", completed: false },
        { session: "evening", completed: true },
      ])
    ).toBe("Morning readings remain.");
  });

  it("mentions both when neither session is complete", () => {
    expect(
      remainingSessionsMessage([
        { session: "morning", completed: false },
        { session: "evening", completed: false },
      ])
    ).toBe("Morning and evening readings remain.");
  });

  it("is not swayed by how many individual readings are incomplete within a session, only whether any are", () => {
    expect(
      remainingSessionsMessage([
        { session: "morning", completed: false },
        { session: "morning", completed: false },
        { session: "morning", completed: false },
        { session: "evening", completed: true },
      ])
    ).toBe("Morning readings remain.");
  });
});
