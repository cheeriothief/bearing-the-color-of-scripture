import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { SystemClock } from "../services/clock";
import { getOrCreateActiveReadingYear } from "../services/readingYearRepo";
import { listShiftEvents } from "../services/shiftEventRepo";
import { getStreamSessionAssignment } from "../services/settingsRepo";
import { resolveAllStreamsForDate } from "../domain/scheduleResolver";
import { findEncounter } from "../services/encounterActions";
import { remainingSessionsMessage, type SessionReadingStatus } from "../domain/homeMessage";
import "./home.css";

const clock = new SystemClock();

/**
 * Atmospheric, restrained landing screen — deliberately not a dashboard.
 * The one piece of "state" it shows is a quiet, non-numeric sentence about
 * what's left today (see domain/homeMessage.ts); everything else is just
 * calm destinations.
 */
export default function Home() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const readingYear = await getOrCreateActiveReadingYear(clock);
      const shiftEvents = await listShiftEvents(readingYear.id);
      const assignment = await getStreamSessionAssignment();
      const today = clock.today();
      const resolved = resolveAllStreamsForDate(today, readingYear, shiftEvents);

      const statuses: SessionReadingStatus[] = [];
      for (const r of resolved) {
        const encounter = await findEncounter(readingYear.id, r.stream, r.ordinal);
        statuses.push({
          session: assignment[r.stream],
          completed: !!encounter?.completedAt,
        });
      }

      if (!cancelled) setMessage(remainingSessionsMessage(statuses));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="home">
      <div className="home__title">Bearing the Color of Scripture</div>
      <div className="home__message">{message ?? ""}</div>
      <div className="home__destinations">
        <Link to="/read" className="home__destination">Read</Link>
        <Link to="/journal" className="home__destination">Journal</Link>
        <Link to="/prayer" className="home__destination">Prayer</Link>
        <Link to="/library" className="home__destination">Library</Link>
      </div>
    </main>
  );
}
