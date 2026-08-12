import db from "./database";

const LAST_THRESHOLD_KEY = "lastThresholdShownDate";

export async function getLastThresholdDate(): Promise<string | null> {
  const row = await db.appState.get(LAST_THRESHOLD_KEY);
  return (row?.value as string | undefined) ?? null;
}

export async function markThresholdShown(dateISO: string): Promise<void> {
  await db.appState.put({ key: LAST_THRESHOLD_KEY, value: dateISO });
}
