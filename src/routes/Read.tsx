import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { ReadingYear, ResolvedReading, StreamKey } from "../domain/types";
import { resolveAllStreamsForDate } from "../domain/scheduleResolver";
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
  findEncounter,
  getPassageNote,
  savePassageNote,
  toggleCompletion,
} from "../services/encounterActions";
import { getOrCreateEncounter } from "../services/database";

const clock = new SystemClock();

const STREAM_LABELS: Record<StreamKey, string> = {
  psalms: "Psalms",
  proverbs: "Proverbs",
  oldTestament: "Old Testament",
  gospel: "Gospel",
  newTestament: "New Testament",
};

export default function Read() {
  const [readingYear, setReadingYear] = useState<ReadingYear | null>(null);
  const [session, setSession] = useState<Session>(() => defaultSessionForTime(clock.now()));

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

  return (
    <main>
      <h1>Reading Desk</h1>
      <p style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-ui)" }}>
        {readingYearLabel(readingYear)}
      </p>

      <div role="group" aria-label="Session">
        <button
          type="button"
          aria-pressed={session === "morning"}
          onClick={() => setSession("morning")}
        >
          Morning
        </button>
        <button
          type="button"
          aria-pressed={session === "evening"}
          onClick={() => setSession("evening")}
        >
          Evening
        </button>
      </div>

      {readingsForSession.length === 0 && <p>Nothing assigned to this session today.</p>}

      <ul style={{ listStyle: "none", padding: 0 }}>
        {readingsForSession.map((r) => (
          <ReadingRow
            key={r.stream}
            readingYearId={readingYear.id}
            resolved={r}
            session={session}
            onReassignSession={(s) => setStreamSession(r.stream, s)}
          />
        ))}
      </ul>
    </main>
  );
}

function ReadingRow({
  readingYearId,
  resolved,
  session,
  onReassignSession,
}: {
  readingYearId: string;
  resolved: ResolvedReading;
  session: Session;
  onReassignSession: (session: Session) => void;
}) {
  const { stream, ordinal, reference } = resolved;
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [encounterId, setEncounterId] = useState<string | null>(null);

  const encounter = useLiveQuery(
    () => findEncounter(readingYearId, stream, ordinal),
    [readingYearId, stream, ordinal]
  );
  const completed = !!encounter?.completedAt;

  async function handleToggleComplete() {
    await toggleCompletion(readingYearId, stream, ordinal);
  }

  async function handleShift() {
    await shiftStream(readingYearId, stream, ordinal, 1);
  }

  async function handleOpenNote() {
    const enc = encounter ?? (await getOrCreateEncounter(readingYearId, stream, ordinal));
    setEncounterId(enc.id);
    const existing = await getPassageNote(enc.id);
    setNoteDraft(existing);
    setNoteOpen(true);
  }

  async function handleSaveNote() {
    if (!encounterId) return;
    await savePassageNote(encounterId, noteDraft);
    setNoteOpen(false);
  }

  const otherSession: Session = session === "morning" ? "evening" : "morning";

  return (
    <li style={{ borderBottom: "1px solid var(--color-border)", padding: "var(--space-3) 0" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)" }}>
        <span style={{ fontFamily: "var(--font-ui)", color: "var(--color-text-muted)" }}>
          {STREAM_LABELS[stream]}
        </span>
        <span
          style={{
            fontFamily: "var(--font-body)",
            textDecoration: completed ? "line-through" : "none",
            color: completed ? "var(--color-text-muted)" : "var(--color-text)",
          }}
        >
          {reference.display}
        </span>
      </div>

      <div style={{ marginTop: "var(--space-2)", display: "flex", gap: "var(--space-2)" }}>
        <button type="button" onClick={handleToggleComplete}>
          {completed ? "Mark incomplete" : "Mark complete"}
        </button>
        {!completed && (
          <button type="button" onClick={handleShift}>
            Shift to tomorrow
          </button>
        )}
        <button type="button" onClick={handleOpenNote}>
          {noteOpen ? "Note open" : "Note"}
        </button>
        <button type="button" onClick={() => onReassignSession(otherSession)} title={`Move to ${otherSession}`}>
          Move to {otherSession}
        </button>
      </div>

      {noteOpen && (
        <div style={{ marginTop: "var(--space-2)" }}>
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            rows={4}
            style={{ width: "100%", fontFamily: "var(--font-body)" }}
            placeholder="Write freely — Markdown supported."
          />
          <div>
            <button type="button" onClick={handleSaveNote}>
              Save note
            </button>
            <button type="button" onClick={() => setNoteOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
