import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { SystemClock, localDateToISO } from "../services/clock";
import {
  getDailyReflection,
  getMonthlyReflection,
  saveDailyReflection,
  saveMonthlyReflection,
} from "../services/reflectionRepo";
import MarkdownView from "../components/MarkdownView";
import "./journal.css";

const clock = new SystemClock();

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function Journal() {
  const today = clock.today();

  return (
    <main className="journal" style={{ padding: "var(--space-4)" }}>
      <h1 style={{ fontFamily: "var(--font-display)" }}>Journal</h1>

      <ReflectionEditor
        title="Daily Reflection"
        subtitle={localDateToISO(today)}
        load={() => getDailyReflection(today)}
        save={(markdown) => saveDailyReflection(today, markdown)}
        queryKey={`daily-${localDateToISO(today)}`}
      />

      <ReflectionEditor
        title="Monthly Reflection"
        subtitle={`${MONTH_NAMES[today.month - 1]} ${today.year}`}
        load={() => getMonthlyReflection(today)}
        save={(markdown) => saveMonthlyReflection(today, markdown)}
        queryKey={`monthly-${today.year}-${today.month}`}
      />
    </main>
  );
}

function ReflectionEditor({
  title,
  subtitle,
  load,
  save,
  queryKey,
}: {
  title: string;
  subtitle: string;
  load: () => Promise<{ markdown: string } | undefined>;
  save: (markdown: string) => Promise<void>;
  queryKey: string;
}) {
  const existing = useLiveQuery(load, [queryKey]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const markdown = existing?.markdown ?? "";

  function beginEditing() {
    setDraft(markdown);
    setEditing(true);
  }

  async function handleSave() {
    await save(draft);
    setEditing(false);
  }

  return (
    <section className="reflection-section">
      <h2 className="reflection-heading">{title}</h2>
      <p className="reflection-sub">{subtitle}</p>

      {editing ? (
        <>
          <textarea
            className="notebook-textarea"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write freely — Markdown supported."
            autoFocus
          />
          <div className="reading-row__actions" style={{ marginTop: "var(--space-2)" }}>
            <button type="button" onClick={handleSave}>
              Save
            </button>
            <button type="button" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <div onClick={beginEditing} className="reflection-view" role="button" tabIndex={0}>
          {markdown.trim() ? (
            <MarkdownView markdown={markdown} />
          ) : (
            <p className="reflection-empty">Nothing written yet — tap to begin.</p>
          )}
        </div>
      )}
    </section>
  );
}
