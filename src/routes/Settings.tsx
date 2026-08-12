import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getTheme, setTheme, type Theme } from "../services/settingsRepo";
import {
  getOrCreateActiveReadingYear,
  hasActivity,
  changeStartDate,
  readingYearLabel,
} from "../services/readingYearRepo";
import { SystemClock, localDateToISO, type LocalDate } from "../services/clock";

const clock = new SystemClock();

const THEME_OPTIONS: { value: Theme; label: string; description: string }[] = [
  {
    value: "prayerbook",
    label: "Prayer Book",
    description: "A bound-book feel — dark reading list, cream notebook page.",
  },
  {
    value: "candlelight",
    label: "Candlelight",
    description: "Deep and warm, built with the Evening session in mind.",
  },
  {
    value: "minimal",
    label: "Minimal",
    description: "The most restrained option — near-monochrome throughout.",
  },
];

export default function Settings() {
  const current = useLiveQuery(() => getTheme(), []);
  const readingYear = useLiveQuery(() => getOrCreateActiveReadingYear(clock), []);
  const activityExists = useLiveQuery(
    () => (readingYear ? hasActivity(readingYear.id) : Promise.resolve(false)),
    [readingYear?.id]
  );

  const [dateDraft, setDateDraft] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    if (readingYear) setDateDraft(localDateToISO(readingYear.startDate));
  }, [readingYear?.id, readingYear?.startDate.year, readingYear?.startDate.month, readingYear?.startDate.day]);

  async function handleSaveStartDate() {
    if (!readingYear) return;
    const [year, month, day] = dateDraft.split("-").map(Number);
    if (!year || !month || !day) return;
    const newStartDate: LocalDate = { year, month, day };

    if (localDateToISO(readingYear.startDate) === dateDraft) return; // no change

    setSaving(true);
    const result = await changeStartDate(readingYear, newStartDate);
    setSaving(false);

    if (result.kind === "created") {
      setSavedMessage(
        "Since this reading year already has activity, a new Reading Year was started instead — your previous one and everything in it are untouched. Reloading…"
      );
    } else {
      setSavedMessage("Start date updated. Reloading…");
    }
    setTimeout(() => window.location.reload(), 1200);
  }

  return (
    <main style={{ padding: "var(--space-4)" }}>
      <h1 style={{ fontFamily: "var(--font-display)" }}>Settings</h1>

      <section style={{ marginTop: "var(--space-4)" }}>
        <h2 style={{ fontFamily: "var(--font-ui)", fontSize: 14, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-muted)" }}>
          Reading Year
        </h2>
        {readingYear && (
          <>
            <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--color-text-muted)", marginTop: "var(--space-2)" }}>
              {readingYearLabel(readingYear)}
            </p>
            <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>
              {activityExists
                ? "You've already completed a reading, shifted a stream, or written a note in this reading year — changing the start date now will begin a new Reading Year rather than editing this one. Your existing progress and notes stay exactly where they are."
                : "Nothing has been recorded yet for this reading year, so the start date can still be freely changed."}
            </p>
            <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", marginTop: "var(--space-3)" }}>
              <input
                type="date"
                value={dateDraft}
                onChange={(e) => setDateDraft(e.target.value)}
                style={{
                  fontFamily: "var(--font-ui)",
                  fontSize: 14,
                  padding: "6px 10px",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  background: "transparent",
                  color: "var(--color-text)",
                }}
              />
              <button
                type="button"
                onClick={handleSaveStartDate}
                disabled={saving || dateDraft === localDateToISO(readingYear.startDate)}
                style={{
                  fontFamily: "var(--font-ui)",
                  fontSize: 13,
                  padding: "6px 14px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--color-accent)",
                  color: "var(--color-accent)",
                  background: "transparent",
                }}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
            {savedMessage && (
              <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--color-accent)", marginTop: "var(--space-2)" }}>
                {savedMessage}
              </p>
            )}
          </>
        )}
      </section>

      <section style={{ marginTop: "var(--space-4)" }}>
        <h2 style={{ fontFamily: "var(--font-ui)", fontSize: 14, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-muted)" }}>
          Theme
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
          {THEME_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              style={{
                display: "flex",
                gap: "var(--space-2)",
                alignItems: "flex-start",
                padding: "var(--space-3)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                background: current === opt.value ? "var(--color-bg-inset)" : "transparent",
              }}
            >
              <input
                type="radio"
                name="theme"
                value={opt.value}
                checked={current === opt.value}
                onChange={() => setTheme(opt.value)}
                style={{ marginTop: 4 }}
              />
              <span>
                <span
                  style={{
                    display: "block",
                    fontFamily: "var(--font-display)",
                    fontSize: 17,
                    color: current === opt.value ? "var(--color-text-inset)" : "var(--color-text)",
                  }}
                >
                  {opt.label}
                </span>
                <span
                  style={{
                    display: "block",
                    fontFamily: "var(--font-ui)",
                    fontSize: 13,
                    color: current === opt.value ? "var(--color-text-muted-inset)" : "var(--color-text-muted)",
                    marginTop: 2,
                  }}
                >
                  {opt.description}
                </span>
              </span>
            </label>
          ))}
        </div>
      </section>
    </main>
  );
}
