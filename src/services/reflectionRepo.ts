import db from "./database";
import type { DailyReflectionRecord, MonthlyReflectionRecord } from "./database";
import type { LocalDate } from "./clock";
import { localDateToISO } from "./clock";
import { reindexTags } from "./tagRepo";

function monthKey(date: LocalDate): string {
  return `${date.year}-${String(date.month).padStart(2, "0")}`;
}

export async function getDailyReflection(date: LocalDate): Promise<DailyReflectionRecord | undefined> {
  return db.dailyReflections.where("date").equals(localDateToISO(date)).first();
}

/**
 * Save (creating if needed) the one Daily Reflection for this calendar
 * date, and reindex its tags. Daily Reflections are keyed to the date
 * itself, not a plan ordinal — per the spec, so they stay meaningful even
 * as streams shift independently of each other.
 */
export async function saveDailyReflection(date: LocalDate, markdown: string): Promise<void> {
  const iso = localDateToISO(date);
  const existing = await db.dailyReflections.where("date").equals(iso).first();
  const now = new Date().toISOString();
  let id: string;
  if (existing) {
    id = existing.id;
    await db.dailyReflections.update(id, { markdown, updatedAt: now });
  } else {
    id = crypto.randomUUID();
    await db.dailyReflections.add({ id, date: iso, markdown, createdAt: now, updatedAt: now });
  }
  await reindexTags("dailyReflection", id, markdown);
}

export async function getMonthlyReflection(
  date: LocalDate
): Promise<MonthlyReflectionRecord | undefined> {
  return db.monthlyReflections.where("month").equals(monthKey(date)).first();
}

export async function saveMonthlyReflection(date: LocalDate, markdown: string): Promise<void> {
  const month = monthKey(date);
  const existing = await db.monthlyReflections.where("month").equals(month).first();
  const now = new Date().toISOString();
  let id: string;
  if (existing) {
    id = existing.id;
    await db.monthlyReflections.update(id, { markdown, updatedAt: now });
  } else {
    id = crypto.randomUUID();
    await db.monthlyReflections.add({ id, month, markdown, createdAt: now, updatedAt: now });
  }
  await reindexTags("monthlyReflection", id, markdown);
}
