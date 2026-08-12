export type SessionName = "morning" | "evening";

export interface SessionReadingStatus {
  session: SessionName;
  completed: boolean;
}

/**
 * The quiet "Evening readings remain" line the spec describes for Home —
 * deliberately not a count, not a progress bar, not phrased as overdue or
 * urgent. Returns null when there's nothing left, since the spec's Home
 * screen should stay restrained rather than becoming a checklist that
 * announces its own completion either.
 */
export function remainingSessionsMessage(items: SessionReadingStatus[]): string | null {
  const remaining = new Set<SessionName>();
  for (const item of items) {
    if (!item.completed) remaining.add(item.session);
  }

  if (remaining.size === 0) return null;
  if (remaining.has("morning") && remaining.has("evening")) {
    return "Morning and evening readings remain.";
  }
  if (remaining.has("morning")) return "Morning readings remain.";
  return "Evening readings remain.";
}
