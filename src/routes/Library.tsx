import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { getScriptureNotesByBook } from "../services/scriptureNotesRepo";
import { getStreamProgress, getRepeatedPassages } from "../services/progressRepo";
import { findByTag, listAllTags } from "../services/tagRepo";
import { buildJsonBackup, buildMarkdownExportZip, downloadBlob } from "../services/exportService";
import { getOrCreateActiveReadingYear } from "../services/readingYearRepo";
import { SystemClock } from "../services/clock";
import MarkdownView from "../components/MarkdownView";
import "./library.css";

const clock = new SystemClock();

const STREAM_LABELS: Record<string, string> = {
  psalms: "Psalms",
  proverbs: "Proverbs",
  oldTestament: "Old Testament",
  gospel: "Gospel",
  newTestament: "New Testament",
};

type Tab = "notes" | "tags" | "progress" | "export";

export default function Library() {
  const [tab, setTab] = useState<Tab>("notes");

  return (
    <main>
      <h1 style={{ padding: "0 var(--space-3)", fontFamily: "var(--font-display)" }}>Library</h1>

      <div className="library-tabs" role="tablist">
        {(["notes", "tags", "progress", "export"] as Tab[]).map((t) => (
          <button key={t} type="button" aria-pressed={tab === t} onClick={() => setTab(t)}>
            {t === "notes" && "Scripture Notes"}
            {t === "tags" && "Tags"}
            {t === "progress" && "Progress"}
            {t === "export" && "Export"}
          </button>
        ))}
      </div>

      {tab === "notes" && <ScriptureNotesPanel />}
      {tab === "tags" && <TagsPanel />}
      {tab === "progress" && <ProgressPanel />}
      {tab === "export" && <ExportPanel />}
    </main>
  );
}

function ScriptureNotesPanel() {
  const groups = useLiveQuery(() => getScriptureNotesByBook(), []);

  if (!groups) return <p className="library-panel">Loading…</p>;
  if (groups.length === 0) {
    return (
      <div className="library-panel">
        <p style={{ fontFamily: "var(--font-ui)", color: "var(--color-text-muted)" }}>
          Nothing archived yet — passage notes appear here once you write them from the
          Reading Desk.
        </p>
      </div>
    );
  }

  return (
    <div className="library-panel">
      {groups.map(({ book, entries }) => (
        <div className="book-group" key={book}>
          <div className="book-group__heading">{book}</div>
          {entries.map((entry) => (
            <div className="note-entry" key={entry.note.id}>
              <div className="note-entry__meta">
                {entry.reference.display} · {STREAM_LABELS[entry.stream]} · ordinal{" "}
                {entry.encounter.ordinal}
              </div>
              <MarkdownView markdown={entry.note.markdown} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function TagsPanel() {
  const [selected, setSelected] = useState<string | null>(null);
  const tags = useLiveQuery(() => listAllTags(), []);
  const sources = useLiveQuery(() => (selected ? findByTag(selected) : Promise.resolve([])), [selected]);

  return (
    <div className="library-panel">
      {tags && tags.length === 0 && (
        <p style={{ fontFamily: "var(--font-ui)", color: "var(--color-text-muted)" }}>
          No tags yet — write #tags naturally into any note or reflection and they'll show up
          here automatically.
        </p>
      )}
      <div>
        {tags?.map((tag) => (
          <button
            key={tag}
            type="button"
            className="tag-pill"
            onClick={() => setSelected(tag === selected ? null : tag)}
            style={{
              background: tag === selected ? "var(--color-accent)" : "none",
              color: tag === selected ? "var(--color-bg-inset)" : "var(--color-accent)",
            }}
          >
            #{tag}
          </button>
        ))}
      </div>

      {selected && (
        <div style={{ marginTop: "var(--space-3)" }}>
          <div className="book-group__heading">#{selected}</div>
          {sources?.length === 0 && (
            <p style={{ fontFamily: "var(--font-ui)", fontSize: 13 }}>Nothing tagged yet.</p>
          )}
          {sources?.map((s) => (
            <div key={s.id} className="note-entry__meta">
              {s.sourceType} · {new Date(s.createdAt).toLocaleDateString()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProgressPanel() {
  const readingYear = useLiveQuery(() => getOrCreateActiveReadingYear(clock), []);
  const progress = useLiveQuery(
    () => (readingYear ? getStreamProgress(readingYear.id) : Promise.resolve(undefined)),
    [readingYear?.id]
  );
  const repeated = useLiveQuery(
    () => (readingYear ? getRepeatedPassages(readingYear.id) : Promise.resolve(undefined)),
    [readingYear?.id]
  );

  if (!progress) return <p className="library-panel">Loading…</p>;

  return (
    <div className="library-panel">
      {progress.map((p) => (
        <div key={p.stream}>
          <div className="progress-row">
            <span>{STREAM_LABELS[p.stream]}</span>
            <span>
              {p.completedCount} of {p.totalAssignments}
            </span>
          </div>
          {p.booksEncountered.length > 0 && (
            <div className="progress-books">{p.booksEncountered.join(", ")}</div>
          )}
        </div>
      ))}

      {repeated && repeated.length > 0 && (
        <div style={{ marginTop: "var(--space-4)" }}>
          <div className="book-group__heading">Repeated encounters</div>
          {repeated.map((r) => (
            <div key={`${r.stream}-${r.display}`} className="progress-row">
              <span>{r.display}</span>
              <span>{r.encounterCount}×</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ExportPanel() {
  async function handleMarkdownExport() {
    try {
      const zip = await buildMarkdownExportZip();
      downloadBlob(zip, "bearing-the-color-of-scripture-export.zip", "application/zip");
    } catch (err) {
      console.error("Markdown export failed:", err);
      alert("The Markdown export couldn't be generated. Try the JSON backup instead — it never depends on this.");
    }
  }

  async function handleJsonBackup() {
    const json = await buildJsonBackup();
    downloadBlob(json, "bearing-the-color-of-scripture-backup.json", "application/json");
  }

  return (
    <div className="library-panel">
      <button type="button" className="export-button" onClick={handleMarkdownExport}>
        <strong>Export as Markdown</strong>
        <span>
          A human-readable .zip: Journal, Monthly Reflections, Passage Notes by book, and a
          progress summary.
        </span>
      </button>
      <button type="button" className="export-button" onClick={handleJsonBackup}>
        <strong>Export JSON backup</strong>
        <span>A complete machine-readable backup of everything stored on this device.</span>
      </button>
    </div>
  );
}
