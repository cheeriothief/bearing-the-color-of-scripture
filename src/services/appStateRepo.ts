import db from "./database";

const LAST_THRESHOLD_KEY = "lastThresholdShownDate";
const ACTIVE_READING_YEAR_KEY = "activeReadingYearId";

export async function getLastThresholdDate(): Promise<string | null> {
  const row = await db.appState.get(LAST_THRESHOLD_KEY);
  return (row?.value as string | undefined) ?? null;
}

export async function markThresholdShown(dateISO: string): Promise<void> {
  await db.appState.put({ key: LAST_THRESHOLD_KEY, value: dateISO });
}

export async function getActiveReadingYearId(): Promise<string | null> {
  const row = await db.appState.get(ACTIVE_READING_YEAR_KEY);
  return (row?.value as string | undefined) ?? null;
}

export async function setActiveReadingYearId(id: string): Promise<void> {
  await db.appState.put({ key: ACTIVE_READING_YEAR_KEY, value: id });
}
