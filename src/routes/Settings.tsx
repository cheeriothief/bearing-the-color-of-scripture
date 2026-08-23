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
import "./settings.css";

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
  }, [readingYear]);

  async function handleSaveStartDate() {
    if (!readingYear) return;
    const [year, month, day] = dateDraft.split("-").map(Number);
    if (!year || !month || !day) return;
    const newStartDate: LocalDate = { year, month, day };

    if (localDateToISO(readingYear.startDate) === dateDraft) return;

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
    <main className="settings">
      <div className="settings__inner">
        <h1 className="settings__title">Settings</h1>
        <div className="settings__surface">
          <section className="settings__section" aria-labelledby="reading-year-heading">
            <h2 className="settings__section-title" id="reading-year-heading">Reading Year</h2>
            {readingYear && (
              <>
                <p className="settings__year-label">{readingYearLabel(readingYear)}</p>
                <p className="settings__explanation">
                  {activityExists
                    ? "You've already completed a reading, shifted a stream, or written a note in this reading year — changing the start date now will begin a new Reading Year rather than editing this one. Your existing progress and notes stay exactly where they are."
                    : "Nothing has been recorded yet for this reading year, so the start date can still be freely changed."}
                </p>
                <div className="settings__date-controls">
                  <label className="settings__date-label" htmlFor="reading-year-start">Reading year start date</label>
                  <input
                    id="reading-year-start"
                    className="settings__date-input"
                    type="date"
                    value={dateDraft}
                    onChange={(e) => setDateDraft(e.target.value)}
                  />
                  <button
                    className="settings__save-button"
                    type="button"
                    onClick={handleSaveStartDate}
                    disabled={saving || dateDraft === localDateToISO(readingYear.startDate)}
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>
                {savedMessage && <p className="settings__saved-message" role="status">{savedMessage}</p>}
              </>
            )}
          </section>

          <section className="settings__section settings__theme-section" aria-labelledby="theme-heading">
            <h2 className="settings__section-title" id="theme-heading">Theme</h2>
            <div className="settings__theme-options" role="radiogroup" aria-labelledby="theme-heading">
              {THEME_OPTIONS.map((opt) => (
                <label className="settings__theme-row" key={opt.value}>
                  <input
                    className="settings__theme-radio"
                    type="radio"
                    name="theme"
                    value={opt.value}
                    checked={current === opt.value}
                    onChange={() => setTheme(opt.value)}
                  />
                  <span className="settings__theme-copy">
                    <span className="settings__theme-name">{opt.label}</span>
                    <span className="settings__theme-description">{opt.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
