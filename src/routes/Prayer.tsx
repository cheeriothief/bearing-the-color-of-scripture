import { PRAYER_BOOK } from "../domain/prayerBook";
import "./prayer.css";

export default function Prayer() {
  return (
    <main className="prayer">
      <div className="prayer__inner">
        <h1 className="prayer__title">Prayer Book</h1>
        <div className="prayer__page">
          <div className="prayer__measure">
            {PRAYER_BOOK.map((prayer) => (
              <article className="prayer-entry" key={prayer.id}>
                <h2 className="prayer-entry__title">{prayer.title}</h2>
                <p className="prayer-entry__attribution">{prayer.attribution}</p>
                <p className="prayer-entry__text">{prayer.text}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
