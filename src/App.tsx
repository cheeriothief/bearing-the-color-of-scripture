import { NavLink, Route, Routes } from "react-router-dom";
import Home from "./routes/Home";
import Read from "./routes/Read";
import Journal from "./routes/Journal";
import Library from "./routes/Library";
import Prayer from "./routes/Prayer";

/**
 * Primary persistent navigation, per the spec — deliberately limited to
 * these five destinations. Nothing else gets added here without a spec
 * change (Threshold and Progress are reached FROM these screens, not
 * additional nav-bar items).
 */
const NAV_ITEMS = [
  { to: "/", label: "Home", end: true },
  { to: "/read", label: "Read", end: false },
  { to: "/journal", label: "Journal", end: false },
  { to: "/library", label: "Library", end: false },
  { to: "/prayer", label: "Prayer", end: false },
] as const;

export default function App() {
  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/read" element={<Read />} />
        <Route path="/journal" element={<Journal />} />
        <Route path="/library" element={<Library />} />
        <Route path="/prayer" element={<Prayer />} />
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
