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
      <section className="home__cover" aria-labelledby="home-title" data-testid="prayer-book-cover">
        <div className="home__frame" aria-hidden="true" />
        <div className="home__emblem" aria-hidden="true"><span /></div>
        <h1 className="home__title" id="home-title">Bearing the Color <span>of Scripture</span></h1>
        <p className="home__message" aria-live="polite">{message ?? ""}</p>
        <div className="home__divider" aria-hidden="true"><span /></div>
        <nav className="home__destinations" aria-label="Home destinations">
          <Link to="/read" className="home__destination">Read</Link>
          <Link to="/journal" className="home__destination">Journal</Link>
          <Link to="/prayer" className="home__destination">Prayer</Link>
          <Link to="/library" className="home__destination">Library</Link>
          <Link to="/settings" className="home__destination">Settings</Link>
        </nav>
      </section>
    </main>
  );
}
