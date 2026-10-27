import { useEffect, useState } from "react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Analytics } from "@vercel/analytics/react";
import Today from "./Today";
import Openings from "./OpeningsPage";
import LeakLab from "./LeakLab";
import { dbAll } from "./storage";
import Connect from "./Connect";
import Review from "./Review";
import DNA from "./DNA";
import Games from "./Games";
import Play from "./Play";
import "./theme.css";
import "./shell.css";
import Settings from "./Settings";
import { applySavedSettings } from "./settingsData";
/*
  Qelvaris, naya design.
  NAV mein wahi pages hain jo PDF mein hain. Har step mein ek ComingSoon ki jagah asli page judta jayega.
*/
const NAV = ["Today", "DNA", "Review", "Leak Lab", "Play", "Openings", "Games"];
const ALL_PAGES = [...NAV, "Settings", "Connect"];

const PAGE_NOTES = {
  Connect: "Username daalke Lichess se games aayengi, aur pehle findings turant banne lagengi. (Step B)",
  Today: "Roz ka 15 minute ka plan: Fix, Review, phir ek Mission. (Step F)",
  DNA: "Aapki 6 skills aur leaks, rating points mein. (Step D)",
  Review: "Game ke 3 turning points, pehle guess karo phir wajah. (Step C)",
  "Leak Lab": "Ek leak chuno aur apni hi games ki positions se practice karo. (Step E)",
  Play: "Mission ke saath bots se khelo. (Step I)",
  Openings: "Aapki apni openings ka tree. (Step H)",
  Games: "Saari games ek library mein. (Step G)",
  Settings: "Board theme, language, backup. (Step J)",
};

function ComingSoon({ title }) {
  return (
    <div className="qv-soon">
      <span className="q-badge q-badge--accent">Coming next</span>
      <h2 className="q-title" style={{ marginTop: 14 }}>
        {title}
      </h2>
      <p className="q-muted">{PAGE_NOTES[title] || "Ye page agle steps mein banega."}</p>
    </div>
  );
}

function App() {
  const [active, setActive] = useState("Today");
  useEffect(() => {
    applySavedSettings();
  }, []);

  // Pehli visit: agar koi game saved nahi hai toh Connect page se shuru karo
  useEffect(() => {
    let alive = true;

    dbAll("games")
      .then((games) => {
        if (alive && games.length === 0) setActive("Connect");
      })
      .catch((error) => console.error("Could not read games:", error));

    return () => {
      alive = false;
    };
  }, []);

  // Baad ke pages ye event bhejenge: window.dispatchEvent(new CustomEvent("qelvaris-navigate", { detail: "Review" }))
  useEffect(() => {
    const onNavigate = (event) => {
      const detail = event.detail;
      const page = typeof detail === "string" ? detail : detail?.page;
      if (ALL_PAGES.includes(page)) setActive(page);
    };

    window.addEventListener("qelvaris-navigate", onNavigate);
    return () => window.removeEventListener("qelvaris-navigate", onNavigate);
  }, []);

  function renderPage() {
    // Jaise-jaise pages banenge, yahan case add hote jayenge.
    if (active === "Settings") return <Settings />;
    if (active === "Games") return <Games />;
    if (active === "Today") return <Today />;
    if (active === "Openings") return <Openings />;
    if (active === "Connect") return <Connect />;
    if (active === "Review") return <Review />;
    if (active === "Leak Lab") return <LeakLab />;
    if (active === "Play") return <Play />;
    if (active === "DNA") return <DNA />;
    return <ComingSoon title={active} />;
  }

  return (
    <div className="qv-shell">
      <header className="qv-topbar">
        <button className="qv-brand" onClick={() => setActive("Today")} aria-label="Go to Qelvaris home">
          <span className="qv-brand-logo">Q</span>
          <span className="qv-brand-name">Qelvaris</span>
        </button>

        <nav className="qv-nav">
          {NAV.map((name) => (
            <button
              key={name}
              className={`qv-tab ${active === name ? "is-active" : ""}`}
              onClick={() => setActive(name)}
              aria-current={active === name ? "page" : undefined}
            >
              {name}
            </button>
          ))}
        </nav>

        <div className="qv-right">
          <button
            className={`qv-settings ${active === "Connect" ? "is-active" : ""}`}
            onClick={() => setActive("Connect")}
          >
            + Add games
          </button>
          <button
            className={`qv-settings ${active === "Settings" ? "is-active" : ""}`}
            onClick={() => setActive("Settings")}
          >
            Settings
          </button>
          <span className="qv-avatar">Y</span>
        </div>
      </header>

      <main className="qv-main">{renderPage()}</main>

      <SpeedInsights />
      <Analytics />
    </div>
  );
}

export default App;