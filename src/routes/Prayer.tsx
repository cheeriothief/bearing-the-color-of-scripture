import { PRAYER_BOOK } from "../domain/prayerBook";
import "./prayer.css";

export default function Prayer() {
  return (
    <main style={{ padding: "var(--space-4)" }}>
      <h1 style={{ fontFamily: "var(--font-display)" }}>Prayer Book</h1>
      {PRAYER_BOOK.map((prayer) => (
        <div className="prayer-entry" key={prayer.id}>
          <div className="prayer-entry__title">{prayer.title}</div>
          <div className="prayer-entry__attribution">{prayer.attribution}</div>
          <div className="prayer-entry__text">{prayer.text}</div>
        </div>
      ))}
    </main>
  );
}
