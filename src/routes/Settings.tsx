import { useLiveQuery } from "dexie-react-hooks";
import { getTheme, setTheme, type Theme } from "../services/settingsRepo";

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

  return (
    <main style={{ padding: "var(--space-4)" }}>
      <h1 style={{ fontFamily: "var(--font-display)" }}>Settings</h1>

      <section style={{ marginTop: "var(--space-4)" }}>
        <h2 style={{ fontFamily: "var(--font-ui)", fontSize: 14, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-muted)" }}>
          Theme
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
          {THEME_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              style={{
                display: "flex",
                gap: "var(--space-2)",
                alignItems: "flex-start",
                padding: "var(--space-3)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                background: current === opt.value ? "var(--color-bg-inset)" : "transparent",
              }}
            >
              <input
                type="radio"
                name="theme"
                value={opt.value}
                checked={current === opt.value}
                onChange={() => setTheme(opt.value)}
                style={{ marginTop: 4 }}
              />
              <span>
                <span
                  style={{
                    display: "block",
                    fontFamily: "var(--font-display)",
                    fontSize: 17,
                    color: current === opt.value ? "var(--color-text-inset)" : "var(--color-text)",
                  }}
                >
                  {opt.label}
                </span>
                <span
                  style={{
                    display: "block",
                    fontFamily: "var(--font-ui)",
                    fontSize: 13,
                    color: current === opt.value ? "var(--color-text-muted-inset)" : "var(--color-text-muted)",
                    marginTop: 2,
                  }}
                >
                  {opt.description}
                </span>
              </span>
            </label>
          ))}
        </div>
      </section>
    </main>
  );
}
