import { useState } from "react";
import { randomPrayer } from "../domain/prayerBook";
import "./threshold.css";

/**
 * Brief transition screen shown on meaningful entry (see App.tsx for the
 * once-per-day trigger logic). Loading space and psychological threshold
 * at once — but the Enter button is available immediately. Nothing here
 * artificially delays getting into the app; the whole point is transition,
 * not friction.
 */
export default function Threshold({ onEnter }: { onEnter: () => void }) {
  const [prayer] = useState(() => randomPrayer());

  return (
    <div className="threshold">
      <p className="threshold__text">{prayer.text}</p>
      <p className="threshold__attribution">
        {prayer.title} — {prayer.attribution}
      </p>
      <button type="button" className="threshold__enter" onClick={onEnter}>
        Enter
      </button>
    </div>
  );
}
