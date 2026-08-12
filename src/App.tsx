import { useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import Home from "./routes/Home";
import Read from "./routes/Read";
import Journal from "./routes/Journal";
import Library from "./routes/Library";
import Prayer from "./routes/Prayer";
import Settings from "./routes/Settings";
import Threshold from "./routes/Threshold";
import GearIcon from "./components/GearIcon";
import { getTheme } from "./services/settingsRepo";
import { getLastThresholdDate, markThresholdShown } from "./services/appStateRepo";
import { shouldShowThreshold } from "./domain/threshold";
import { SystemClock, localDateToISO } from "./services/clock";

const clock = new SystemClock();

/**
 * Primary persistent navigation, per the spec — deliberately limited to
 * these five destinations. Settings is intentionally NOT in this list; it's
 * reached via the gear icon in the header instead, so it never competes
 * with Home/Read/Journal/Library/Prayer for primary attention.
 */
const NAV_ITEMS = [
  { to: "/", label: "Home", end: true },
  { to: "/read", label: "Read", end: false },
  { to: "/journal", label: "Journal", end: false },
  { to: "/library", label: "Library", end: false },
  { to: "/prayer", label: "Prayer", end: false },
] as const;

export default function App() {
  const theme = useLiveQuery(() => getTheme(), []);
  const [thresholdVisible, setThresholdVisible] = useState<boolean | null>(null);

  useEffect(() => {
    if (theme) {
      document.documentElement.setAttribute("data-theme", theme);
    }
  }, [theme]);

  useEffect(() => {
    getLastThresholdDate().then((last) => {
      setThresholdVisible(shouldShowThreshold(last, clock.today()));
    });
  }, []);

  async function handleEnter() {
    await markThresholdShown(localDateToISO(clock.today()));
    setThresholdVisible(false);
  }

  if (thresholdVisible) {
    return <Threshold onEnter={handleEnter} />;
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <NavLink to="/settings" aria-label="Settings" className="settings-link">
          <GearIcon />
        </NavLink>
      </header>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/read" element={<Read />} />
        <Route path="/journal" element={<Journal />} />
        <Route path="/library" element={<Library />} />
        <Route path="/prayer" element={<Prayer />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
      <nav aria-label="Primary">
        <ul>
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} end={item.end}>
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
