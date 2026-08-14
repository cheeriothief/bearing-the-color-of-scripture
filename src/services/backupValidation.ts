import { getPlanDay, loadDataset } from "../domain/datasetAdapter";
import { STREAM_KEYS, type ReadingYear, type StreamKey, type StreamShiftEvent } from "../domain/types";
import type {
  AppStateRecord,
  DailyReflectionRecord,
  EncounterRecord,
  MonthlyReflectionRecord,
  PassageNoteRecord,
  SettingRecord,
  TagReferenceRecord,
} from "./database";
import { localDateToISO, type LocalDate } from "./clock";

export interface ParsedBackup {
  backupVersion: number;
  exportedAt: string;
  readingPlanDatasetVersion?: string;
  readingYears: ReadingYear[];
  streamShiftEvents: StreamShiftEvent[];
  encounters: EncounterRecord[];
  passageNotes: PassageNoteRecord[];
  dailyReflections: DailyReflectionRecord[];
  monthlyReflections: MonthlyReflectionRecord[];
  tagReferences: TagReferenceRecord[];
  settings: SettingRecord[];
  appState: AppStateRecord[];
}

export class InvalidBackupError extends Error {}

const TABLE_KEYS = [
  "readingYears", "streamShiftEvents", "encounters", "passageNotes",
  "dailyReflections", "monthlyReflections", "tagReferences", "settings", "appState",
] as const;
const STREAMS = new Set<string>(STREAM_KEYS);

function fail(path: string, problem: string): never {
  throw new InvalidBackupError(`${path}: ${problem}`);
}

function objectAt(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(path, "must be an object");
  }
  return value as Record<string, unknown>;
}

function stringAt(row: Record<string, unknown>, field: string, path: string): string {
  const value = row[field];
  if (typeof value !== "string") fail(`${path}.${field}`, "must be a string");
  return value;
}

function idAt(row: Record<string, unknown>, field: string, path: string): string {
  const value = stringAt(row, field, path);
  if (!value.trim()) fail(`${path}.${field}`, "must not be empty");
  return value;
}

function integerAt(row: Record<string, unknown>, field: string, path: string): number {
  const value = row[field];
  if (!Number.isInteger(value)) fail(`${path}.${field}`, "must be an integer");
  return value as number;
}

function timestampAt(row: Record<string, unknown>, field: string, path: string): string {
  const value = stringAt(row, field, path);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    fail(`${path}.${field}`, "must be an ISO 8601 UTC timestamp");
  }
  return value;
}

function validLocalDate(value: unknown, path: string): LocalDate {
  const row = objectAt(value, path);
  const year = integerAt(row, "year", path);
  const month = integerAt(row, "month", path);
  const day = integerAt(row, "day", path);
  if (year < 1 || year > 9999) fail(`${path}.year`, "must be between 1 and 9999");
  if (month < 1 || month > 12) fail(`${path}.month`, "must be between 1 and 12");
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > daysInMonth) fail(`${path}.day`, "is not valid for that month");
  return { year, month, day };
}

function calendarDateAt(row: Record<string, unknown>, field: string, path: string): string {
  const value = stringAt(row, field, path);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) fail(`${path}.${field}`, "must be a valid YYYY-MM-DD date");
  const date = validLocalDate(
    { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) },
    `${path}.${field}`
  );
  if (localDateToISO(date) !== value) fail(`${path}.${field}`, "must be a valid YYYY-MM-DD date");
  return value;
}

function unique(value: string, seen: Set<string>, path: string, label: string): void {
  if (seen.has(value)) fail(path, `duplicates ${label} "${value}"`);
  seen.add(value);
}

function streamAt(row: Record<string, unknown>, field: string, path: string): StreamKey {
  const value = stringAt(row, field, path);
  if (!STREAMS.has(value)) fail(`${path}.${field}`, `has invalid stream "${value}"`);
  return value as StreamKey;
}

function ordinalAt(row: Record<string, unknown>, field: string, path: string): number {
  const ordinal = integerAt(row, field, path);
  const dataset = loadDataset();
  const max = dataset.ordinalBase + dataset.readingYearLength - 1;
  if (ordinal < dataset.ordinalBase || ordinal > max) {
    fail(`${path}.${field}`, `must be between ${dataset.ordinalBase} and ${max}`);
  }
  return ordinal;
}

export function parseJsonBackup(json: string): ParsedBackup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new InvalidBackupError("That file isn't valid JSON.");
  }
  const root = objectAt(parsed, "backup");
  if (root.backupVersion !== 1) {
    fail("backup.backupVersion", `unrecognized backup version ${String(root.backupVersion)}`);
  }
  timestampAt(root, "exportedAt", "backup");
  for (const key of TABLE_KEYS) {
    if (!Array.isArray(root[key])) fail(`backup.${key}`, "must be an array");
  }

  const bundledVersion = loadDataset().datasetVersion;
  const backupDatasetVersion = root.readingPlanDatasetVersion;
  if (backupDatasetVersion !== undefined && typeof backupDatasetVersion !== "string") {
    fail("backup.readingPlanDatasetVersion", "must be a string");
  }
  if (typeof backupDatasetVersion === "string" && backupDatasetVersion !== bundledVersion) {
    fail(
      "backup.readingPlanDatasetVersion",
      `is "${backupDatasetVersion}", but this app requires "${bundledVersion}"`
    );
  }
  if (
    backupDatasetVersion === undefined &&
    ((root.streamShiftEvents as unknown[]).length > 0 ||
      (root.encounters as unknown[]).length > 0 ||
      (root.passageNotes as unknown[]).length > 0)
  ) {
    fail(
      "backup.readingPlanDatasetVersion",
      "is missing from this legacy backup, so its reading-plan ordinals cannot be restored safely"
    );
  }

  const idSets = new Map<string, Set<string>>();
  const ids = (table: string) => {
    const set = new Set<string>();
    idSets.set(table, set);
    return set;
  };
  const readingYearIds = ids("readingYears");
  const encounterIds = ids("encounters");
  const passageNoteIds = ids("passageNotes");
  const dailyIds = ids("dailyReflections");
  const monthlyIds = ids("monthlyReflections");

  (root.readingYears as unknown[]).forEach((value, index) => {
    const path = `readingYears[${index}]`;
    const row = objectAt(value, path);
    unique(idAt(row, "id", path), readingYearIds, `${path}.id`, "reading-year id");
    validLocalDate(row.startDate, `${path}.startDate`);
    timestampAt(row, "createdAt", path);
  });

  const shiftIds = ids("streamShiftEvents");
  (root.streamShiftEvents as unknown[]).forEach((value, index) => {
    const path = `streamShiftEvents[${index}]`;
    const row = objectAt(value, path);
    unique(idAt(row, "id", path), shiftIds, `${path}.id`, "shift id");
    const yearId = idAt(row, "readingYearId", path);
    if (!readingYearIds.has(yearId)) fail(`${path}.readingYearId`, `references missing reading year "${yearId}"`);
    const stream = streamAt(row, "stream", path);
    const startingOrdinal = ordinalAt(row, "startingOrdinal", path);
    if (!getPlanDay(startingOrdinal)?.streams[stream]) {
      fail(`${path}.startingOrdinal`, "has no assignment for this stream");
    }
    const delay = integerAt(row, "delayDays", path);
    if (delay <= 0) fail(`${path}.delayDays`, "must be a positive integer");
    timestampAt(row, "createdAt", path);
  });

  const encounterLogicalKeys = new Set<string>();
  (root.encounters as unknown[]).forEach((value, index) => {
    const path = `encounters[${index}]`;
    const row = objectAt(value, path);
    unique(idAt(row, "id", path), encounterIds, `${path}.id`, "encounter id");
    const yearId = idAt(row, "readingYearId", path);
    if (!readingYearIds.has(yearId)) fail(`${path}.readingYearId`, `references missing reading year "${yearId}"`);
    const stream = streamAt(row, "stream", path);
    const ordinal = ordinalAt(row, "ordinal", path);
    if (!getPlanDay(ordinal)?.streams[stream]) fail(`${path}.ordinal`, "has no assignment for this stream");
    unique(`${yearId}|${stream}|${ordinal}`, encounterLogicalKeys, path, "reading year/stream/ordinal");
    if (row.completedAt !== null) timestampAt(row, "completedAt", path);
    timestampAt(row, "createdAt", path);
  });

  const notesByEncounter = new Set<string>();
  (root.passageNotes as unknown[]).forEach((value, index) => {
    const path = `passageNotes[${index}]`;
    const row = objectAt(value, path);
    unique(idAt(row, "id", path), passageNoteIds, `${path}.id`, "passage-note id");
    const encounterId = idAt(row, "encounterId", path);
    if (!encounterIds.has(encounterId)) fail(`${path}.encounterId`, `references missing encounter "${encounterId}"`);
    unique(encounterId, notesByEncounter, `${path}.encounterId`, "passage note for encounter");
    stringAt(row, "markdown", path);
    timestampAt(row, "createdAt", path);
    timestampAt(row, "updatedAt", path);
  });

  const dailyDates = new Set<string>();
  (root.dailyReflections as unknown[]).forEach((value, index) => {
    const path = `dailyReflections[${index}]`;
    const row = objectAt(value, path);
    unique(idAt(row, "id", path), dailyIds, `${path}.id`, "daily-reflection id");
    const date = calendarDateAt(row, "date", path);
    unique(date, dailyDates, `${path}.date`, "daily reflection date");
    stringAt(row, "markdown", path);
    timestampAt(row, "createdAt", path);
    timestampAt(row, "updatedAt", path);
  });

  const monthlyMonths = new Set<string>();
  (root.monthlyReflections as unknown[]).forEach((value, index) => {
    const path = `monthlyReflections[${index}]`;
    const row = objectAt(value, path);
    unique(idAt(row, "id", path), monthlyIds, `${path}.id`, "monthly-reflection id");
    const month = stringAt(row, "month", path);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || Number(month.slice(0, 4)) < 1) {
      fail(`${path}.month`, "must be a valid YYYY-MM month");
    }
    unique(month, monthlyMonths, `${path}.month`, "monthly reflection month");
    stringAt(row, "markdown", path);
    timestampAt(row, "createdAt", path);
    timestampAt(row, "updatedAt", path);
  });

  const tagIds = ids("tagReferences");
  const logicalTags = new Set<string>();
  (root.tagReferences as unknown[]).forEach((value, index) => {
    const path = `tagReferences[${index}]`;
    const row = objectAt(value, path);
    unique(idAt(row, "id", path), tagIds, `${path}.id`, "tag-reference id");
    const tag = stringAt(row, "tag", path);
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(tag)) fail(`${path}.tag`, "has invalid tag syntax");
    const sourceType = stringAt(row, "sourceType", path);
    const sources = sourceType === "passageNote" ? passageNoteIds
      : sourceType === "dailyReflection" ? dailyIds
      : sourceType === "monthlyReflection" ? monthlyIds
      : fail(`${path}.sourceType`, `has invalid source type "${sourceType}"`);
    const sourceId = idAt(row, "sourceId", path);
    if (!sources.has(sourceId)) fail(`${path}.sourceId`, `references missing ${sourceType} "${sourceId}"`);
    unique(`${sourceType}|${sourceId}|${tag}`, logicalTags, path, "tag/source relationship");
    timestampAt(row, "createdAt", path);
  });

  const settingKeys = new Set<string>();
  (root.settings as unknown[]).forEach((value, index) => {
    const path = `settings[${index}]`;
    const row = objectAt(value, path);
    const key = idAt(row, "key", path);
    unique(key, settingKeys, `${path}.key`, "setting key");
    if (!("value" in row)) fail(`${path}.value`, "is required");
    if (key === "theme" && !["prayerbook", "candlelight", "minimal"].includes(String(row.value))) {
      fail(`${path}.value`, "has invalid theme");
    }
    if (key === "streamSessionAssignment") {
      const assignment = objectAt(row.value, `${path}.value`);
      for (const [stream, session] of Object.entries(assignment)) {
        if (!STREAMS.has(stream) || (session !== "morning" && session !== "evening")) {
          fail(`${path}.value.${stream}`, "has invalid stream session assignment");
        }
      }
    }
  });

  const appStateKeys = new Set<string>();
  (root.appState as unknown[]).forEach((value, index) => {
    const path = `appState[${index}]`;
    const row = objectAt(value, path);
    const key = idAt(row, "key", path);
    unique(key, appStateKeys, `${path}.key`, "app-state key");
    if (!("value" in row)) fail(`${path}.value`, "is required");
    if (key === "activeReadingYearId") {
      if (typeof row.value !== "string" || !readingYearIds.has(row.value)) {
        fail(`${path}.value`, "must reference an existing reading year");
      }
    }
    if (key === "lastThresholdShownDate") calendarDateAt(row, "value", path);
  });

  return root as unknown as ParsedBackup;
}
