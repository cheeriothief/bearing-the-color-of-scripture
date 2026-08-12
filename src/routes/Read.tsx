import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { ReadingYear, ResolvedReading, StreamKey } from "../domain/types";
import { resolveAllStreamsForDate } from "../domain/scheduleResolver";
import { findPriorOrdinalsWithSameReference } from "../domain/datasetAdapter";
import { SystemClock } from "../services/clock";
import { getOrCreateActiveReadingYear, readingYearLabel } from "../services/readingYearRepo";
import { listShiftEvents, shiftStream } from "../services/shiftEventRepo";
import {
  defaultSessionForTime,
  getStreamSessionAssignment,
  setStreamSession,
  streamsForSession,
  type Session,
} from "../services/settingsRepo";
import {
  countEngagedEncounters,
  findEncounter,
  getPassageNote,
  savePassageNote,
  toggleCompletion,
} from "../services/encounterActions";
import { getOrCreateEncounter } from "../services/database";
import "./readingDesk.css";

const clock = new SystemClock();

const STREAM_LABELS: Record<StreamKey, string> = {
  psalms: "Psalms",
  proverbs: "Proverbs",
  oldTestament: "Old Testament",
  gospel: "Gospel",
  newTestament: "New Testament",
};

const SWIPE_COMPLETE_THRESHOLD = 72; // px of left-to-right drag before completion fires

export default function Read() {
  const [readingYear, setReadingYear] = useState<ReadingYear | null>(null);
  const [session, setSession] = useState<Session>(() => defaultSessionForTime(clock.now()));
  const [selectedStream, setSelectedStream] = useState<StreamKey | null>(null);

  useEffect(() => {
    getOrCreateActiveReadingYear(clock).then(setReadingYear);
  }, []);

  const shiftEvents = useLiveQuery(
    () => (readingYear ? listShiftEvents(readingYear.id) : Promise.resolve([])),
    [readingYear?.id]
  );

  const assignment = useLiveQuery(() => getStreamSessionAssignment(), []);

  const today = clock.today();

  const resolved: ResolvedReading[] = useMemo(() => {
    if (!readingYear || !shiftEvents) return [];
    return resolveAllStreamsForDate(today, readingYear, shiftEvents);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readingYear, shiftEvents, today.year, today.month, today.day]);

  if (!readingYear || !assignment) {
    return (
      <main>
        <p>Loading…</p>
      </main>
    );
  }

  const visibleStreams = streamsForSession(assignment, session);
  const readingsForSession = resolved.filter((r) => visibleStreams.includes(r.stream));

  // Tablet always shows a notebook pane; default it to the first reading if
  // nothing has been explicitly selected yet.
  const effectiveSelected =
    readingsForSession.find((r) => r.stream === selectedStream) ?? readingsForSession[0] ?? null;

  const listHidden = selectedStream !== null; // only matters on phone width
  const notebookHidden = selectedStream === null && readingsForSession.length === 0;

  return (
    <main className="reading-desk">
      <h1 style={{ padding: "0 var(--space-3)", fontFamily: "var(--font-display)" }}>
        Reading Desk
      </h1>
      <p
        style={{
          padding: "0 var(--space-3)",
          color: "var(--color-text-muted)",
          fontFamily: "var(--font-ui)",
          fontSize: 13,
        }}
      >
        {readingYearLabel(readingYear)}
      </p>

      <div className="reading-desk__session" role="group" aria-label="Session">
        <button type="button" aria-pressed={session === "morning"} onClick={() => setSession("morning")}>
          Morning
        </button>
        <button type="button" aria-pressed={session === "evening"} onClick={() => setSession("evening")}>
          Evening
        </button>
      </div>

      <div className="reading-desk__panes">
        <div className="reading-desk__list" data-hidden={listHidden}>
          {readingsForSession.length === 0 && (
            <p style={{ fontFamily: "var(--font-ui)", fontSize: 13 }}>
              Nothing assigned to this session today.
            </p>
          )}
          {readingsForSession.map((r) => (
            <ReadingRow
              key={r.stream}
              readingYearId={readingYear.id}
              resolved={r}
              selected={effectiveSelected?.stream === r.stream}
              onSelect={() => setSelectedStream(r.stream)}
            />
          ))}
        </div>

        <div className="reading-desk__notebook" data-hidden={notebookHidden}>
          {effectiveSelected ? (
            <Notebook
              readingYearId={readingYear.id}
              resolved={effectiveSelected}
              onBack={() => setSelectedStream(null)}
              session={session}
              onReassignSession={(s) => setStreamSession(effectiveSelected.stream, s)}
            />
          ) : (
            <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--color-text-muted)" }}>
              Select a reading.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

function ReadingRow({
  readingYearId,
  resolved,
  selected,
  onSelect,
}: {
  readingYearId: string;
  resolved: ResolvedReading;
  selected: boolean;
  onSelect: () => void;
}) {
  const { stream, ordinal, reference } = resolved;
  const encounter = useLiveQuery(
    () => findEncounter(readingYearId, stream, ordinal),
    [readingYearId, stream, ordinal]
  );
  const completed = !!encounter?.completedAt;

  const priorOrdinals = useMemo(
    () => findPriorOrdinalsWithSameReference(stream, ordinal, reference),
    [stream, ordinal, reference.book, reference.startChapter, reference.endChapter]
  );
  const priorCount = useLiveQuery(
    () => countEngagedEncounters(readingYearId, stream, priorOrdinals),
    [readingYearId, stream, priorOrdinals.join(",")]
  );

  // --- Swipe-to-complete (left-to-right), with a non-swipe fallback button
  // for accessibility and to avoid edge-swipe conflicts, per the spec. ---
  const contentRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startX: number; dragging: boolean } | null>(null);
  const [dragX, setDragX] = useState(0);

  function handleTouchStart(e: React.TouchEvent) {
    dragState.current = { startX: e.touches[0].clientX, dragging: true };
  }
  function handleTouchMove(e: React.TouchEvent) {
    if (!dragState.current?.dragging) return;
    const delta = e.touches[0].clientX - dragState.current.startX;
    if (delta > 0) setDragX(Math.min(delta, 140)); // only left-to-right, capped
  }
  async function handleTouchEnd() {
    if (dragState.current?.dragging && dragX >= SWIPE_COMPLETE_THRESHOLD) {
      await toggleCompletion(readingYearId, stream, ordinal);
    }
    setDragX(0);
    dragState.current = null;
  }

  async function handleToggleComplete() {
    await toggleCompletion(readingYearId, stream, ordinal);
  }

  return (
    <div
      className="reading-row"
      onClick={onSelect}
      style={{
        cursor: "pointer",
        outline: selected ? "1px solid var(--color-accent)" : "none",
        // Subtle background tint tracks the swipe so there's still feedback
        // mid-gesture, but nothing about the text itself moves or slides.
        backgroundColor: `color-mix(in srgb, var(--color-accent) ${Math.min(
          (dragX / SWIPE_COMPLETE_THRESHOLD) * 25,
          25
        )}%, transparent)`,
      }}
    >
      <div
        ref={contentRef}
        className="reading-row__content"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <span className="reading-row__stream">{STREAM_LABELS[stream]}</span>
        <span className="reading-row__ref" data-completed={completed}>
          {reference.display}
        </span>
        {!!priorCount && priorCount > 0 && (
          <span className="reading-row__badge">
            {priorCount} previous encounter{priorCount === 1 ? "" : "s"}
          </span>
        )}
        <div className="reading-row__actions">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleComplete();
            }}
          >
            {completed ? "Mark incomplete" : "Mark complete"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Notebook({
  readingYearId,
  resolved,
  onBack,
  session,
  onReassignSession,
}: {
  readingYearId: string;
  resolved: ResolvedReading;
  onBack: () => void;
  session: Session;
  onReassignSession: (session: Session) => void;
}) {
  const { stream, ordinal, reference } = resolved;
  const [noteDraft, setNoteDraft] = useState("");
  const [encounterId, setEncounterId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    (async () => {
      const enc = await getOrCreateEncounter(readingYearId, stream, ordinal);
      const existing = await getPassageNote(enc.id);
      if (!cancelled) {
        setEncounterId(enc.id);
        setNoteDraft(existing);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [readingYearId, stream, ordinal]);

  async function handleSave() {
    if (!encounterId) return;
    await savePassageNote(encounterId, noteDraft);
  }

  async function handleShift() {
    await shiftStream(readingYearId, stream, ordinal, 1);
  }

  const otherSession: Session = session === "morning" ? "evening" : "morning";

  return (
    <div>
      <button type="button" className="notebook-back" onClick={onBack}>
        ← Back to readings
      </button>
      <div className="notebook-heading">{reference.display}</div>
      <div className="notebook-sub">
        {STREAM_LABELS[stream]} · ordinal {ordinal}
      </div>

      <textarea
        className="notebook-textarea"
        value={loaded ? noteDraft : ""}
        onChange={(e) => setNoteDraft(e.target.value)}
        onBlur={handleSave}
        placeholder="Write freely — Markdown supported."
        disabled={!loaded}
      />

      <div className="reading-row__actions" style={{ marginTop: "var(--space-3)" }}>
        <button type="button" onClick={handleSave}>
          Save note
        </button>
        <button type="button" onClick={handleShift}>
          Shift to tomorrow
        </button>
        <button type="button" onClick={() => onReassignSession(otherSession)}>
          Move to {otherSession}
        </button>
      </div>
    </div>
  );
}
