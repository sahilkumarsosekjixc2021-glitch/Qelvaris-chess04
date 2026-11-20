import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Analytics } from "@vercel/analytics/react";


import Today from "./Today"; // pehla page hai, isliye turant load
import { dbAll } from "./storage";
import { useAuth } from "./context/AuthContext";
import StreakBadge from "./features/streak/StreakBadge"; // QV-STREAK
import QcChip from "./features/qc/QcChip"; // QV-QC
import CelebrationHost from "./features/celebrate/CelebrationHost"; // QV-CELEBRATE
import FeedbackButton from "./features/feedback/FeedbackButton"; // QV-FEEDBACK
import { track } from "./features/telemetry/track"; // QV-TRACK
import { maybeAutoBackup } from "./features/cloud/cloud"; // QV-SYNC
import ErrorBoundary from "./components/ErrorBoundary"; // QV-ERR
import "./features/a11y/a11y.css"; // QV-A11Y
import "./QelvarisTheme.css";
import "./QelvarisNav.css";

import "./theme.css";
import "./shell.css";

import { applySavedSettings } from "./settingsData";
import { tx } from "./i18n/pages/app"; // QV-I18N
import { useT, getLang } from "./i18n/i18n"; // QV-I18N
import { playSound, unlockAudio } from "./sound";
import OfflineBanner from "./components/OfflineBanner";
import ConfirmHost from "./components/ConfirmHost";

/* QV-PERF: baaki pages tab load hote hain jab user wahan jaye (Stockfish, multiplayer, games wagairah
   shuru mein download nahi hote). Naye deploy ke baad purani tab mein chunk na mile to ek baar page reload. */
function lazyPage(loader) {
  return lazy(() =>
    loader().catch((error) => {
      try {
        if (!sessionStorage.getItem("qv-chunk-reload")) {
          sessionStorage.setItem("qv-chunk-reload", "1");
          window.location.reload();
          return new Promise(() => {});
        }
        sessionStorage.removeItem("qv-chunk-reload");
      } catch {
        /* ignore */
      }
      throw error;
    })
  );
}

const Openings = lazyPage(() => import("./Openings.jsx"));
const LeakLab = lazyPage(() => import("./LeakLab"));
const Connect = lazyPage(() => import("./Connect"));
const Review = lazyPage(() => import("./Review"));
const DNA = lazyPage(() => import("./DNA"));
const Games = lazyPage(() => import("./Games"));
const Play = lazyPage(() => import("./Play"));
const Settings = lazyPage(() => import("./Settings"));
const Profile = lazyPage(() => import("./Profile"));
const Store = lazyPage(() => import("./features/qc/Store")); // QV-QC

function PageFallback() {
  return null; /* Loading… text hata diya */
}

const NAV = [
  "Today",
  "DNA",
  "Review",
  "Leak Lab",
  "Play",
  "Openings",
  "Games",
];

const ALL_PAGES = [...NAV, "Profile", "Settings", "Connect", "Store"];

/* Is page par network-lines wala background NAHI lagega (game modes wale pages).
   Sab doosre pages par lagega. */
const NO_BACKGROUND_PAGE = "Play";

/* Har dropdown ki rows yahin se badalti hain.
   section = page ke andar kaun sa hissa khulega. icon = chhota nishaan. */
const NAV_MENUS = {
  "Leak Lab": [
    {
      label: "Your leaks",
      section: "leaks",
      description: "Train your personal weaknesses",
      icon: "◎",
    },
    {
      label: "Practice puzzles",
      section: "puzzles",
      description: "Solve fresh chess puzzles",
      icon: "✣",
    },
  ],
  Openings: [
    {
      label: "Opening tree",
      section: "tree",
      description: "Your lines as White and Black",
      icon: "♟",
    },
    {
      label: "Explore",
      section: "explore",
      description: "Browse every opening",
      icon: "⌕",
    },
    {
      label: "Study",
      section: "study",
      description: "Learn the main ideas",
      icon: "♞",
    },
    {
      label: "Practice",
      section: "practice",
      description: "Test yourself on a line",
      icon: "↻",
    },
    {
      label: "My repertoire",
      section: "repertoire",
      description: "Openings you saved",
      icon: "★",
    },
  ],
  Games: [
    {
      label: "All games",
      section: "all",
      description: "Your full archive",
      icon: "♟",
    },
    {
      label: "Wins",
      section: "win",
      description: "Games you won",
      icon: "♛",
    },
    {
      label: "Losses",
      section: "loss",
      description: "Games to learn from",
      icon: "♜",
    },
    {
      label: "Draws",
      section: "draw",
      description: "Shared results",
      icon: "♝",
    },
    {
      label: "Saved",
      section: "saved",
      description: "Games you starred",
      icon: "☆",
    },
  ],
};

const PAGE_NOTES = {
  Connect: "Connect your chess games to start discovering your weaknesses.",
  Today: "Your daily personalized chess improvement plan.",
  DNA: "Understand your chess skills and weaknesses.",
  Review: "Explore the important turning points in your games.",
  "Leak Lab": "Practice positions from your own games.",
  Play: "Enter the Qelvaris game room.",
  Openings: "Explore your personal opening tree.",
  Games: "All your chess games in one library.",
  Profile: "Your personal chess identity and player overview.",
  Settings: "Board theme, language and data settings.",
  Store: "Earn QC by training and spend it on streak freezes and badges.",
};

function ComingSoon({ title }) {
  return (
    <div className="qv-soon">
      <span className="q-badge q-badge--accent">
        {tx("Coming next")}</span>

      <h2 className="q-title" style={{ marginTop: 14 }}>
        {tx(title)}
      </h2>

      <p className="q-muted">
        {tx(PAGE_NOTES[title] || "This page is coming soon.")}
      </p>
    </div>
  );
}

// QV-NAV: the open page lives in the address (#/openings) so a refresh, Back/Forward and shared links
// return to the same page instead of Today. Only "#/..." hashes are read; anything else is ignored.
const pageSlug = (name) => "#/" + String(name).toLowerCase().replace(/\s+/g, "-");
function pageFromHash() {
  const h = typeof window === "undefined" ? "" : window.location.hash;
  if (!h.startsWith("#/")) return null;
  return ALL_PAGES.find((name) => pageSlug(name) === h.toLowerCase()) || null;
}

function App() {
  useT(); // QV-I18N: re-render the nav when the language changes
  const { user } = useAuth();

  const [active, setActive] = useState(() => pageFromHash() || "Today");
  const firstHashSync = useRef(true);
  const hadHash = useRef(pageFromHash() !== null); // opened on a specific page (refresh / shared link)?
  const [pendingSection, setPendingSection] = useState(null);

  /* Dropdown menu hata diya, isliye ab band karne ko kuch nahi. Purane calls ke liye khali function. */
  const closeMenuNow = useCallback(() => {}, []);

  useEffect(() => {
    applySavedSettings();
    track("app_open");
    maybeAutoBackup(); // QV-SYNC: only runs if the user turned automatic backup on
  }, []);

  // QV-A11Y: har page ka apna title (tab, screen reader, history mein dikhta hai)
  useEffect(() => {
    const original = document.title;
    return () => {
      document.title = original;
    };
  }, []);

  useEffect(() => {
    document.title = `${tx(active)} | Qelvaris`;
  }, [active, getLang()]);

  // QV-NAV: keep the address bar in step with the page (first time replaces, later changes add history entries)
  useEffect(() => {
    const want = pageSlug(active);
    if (window.location.hash.toLowerCase() === want) {
      firstHashSync.current = false;
      return;
    }
    if (firstHashSync.current) window.history.replaceState(null, "", want);
    else window.history.pushState(null, "", want);
    firstHashSync.current = false;
  }, [active]);

  // QV-NAV: browser Back / Forward
  useEffect(() => {
    const onHash = () => {
      const page = pageFromHash();
      if (page) setActive(page);
    };
    window.addEventListener("popstate", onHash);
    window.addEventListener("hashchange", onHash);
    return () => {
      window.removeEventListener("popstate", onHash);
      window.removeEventListener("hashchange", onHash);
    };
  }, []);

  useEffect(() => {
    let alive = true;

    dbAll("games")
      .then((games) => {
        if (alive && games.length === 0 && !hadHash.current) {
          setActive("Connect"); // only for a brand-new visit, not when refreshing on another page
        }
      })
      .catch((error) => {
        console.error("Could not read games:", error);
      });

    return () => {
      alive = false;
    };
  }, []);

  // Handle navigation events from other pages.
  useEffect(() => {
    const onNavigate = (event) => {
      const detail = event.detail;

      const page =
        typeof detail === "string"
          ? detail
          : detail?.page;

      if (ALL_PAGES.includes(page)) {
        setActive(page);
        closeMenuNow();
      }
    };

    window.addEventListener("qelvaris-navigate", onNavigate);

    return () => {
      window.removeEventListener("qelvaris-navigate", onNavigate);
    };
  }, [closeMenuNow]);

  /* Page khulne ke BAAD section ka event bhejo, taaki naya page use sun sake */
  useEffect(() => {
    if (!pendingSection || pendingSection.page !== active) return;

    window.dispatchEvent(
      new CustomEvent("qelvaris-subnavigate", { detail: pendingSection })
    );
    setPendingSection(null);
  }, [pendingSection, active]);

  function navigate(page) {
    setActive(page);
    closeMenuNow();
  }

  // Page ke andar kisi hisse par jao (Leak Lab, Openings, Games).
  function navigateToSection(page, section) {
    setActive(page);
    closeMenuNow();
    setPendingSection({ page, section });
  }

  function handleShellClick(event) {
    const button = event.target.closest("button");

    if (!button || button.disabled) return;
    if (button.closest(".qb-board")) return;

    unlockAudio();
    playSound("click");
  }

  function renderPage() {
    if (active === "Profile") return <Profile />;
    if (active === "Store") return <Store />;
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
    <div className="qv-shell" onClick={handleShellClick}>
      <a className="qa-skip" href="#qv-content">{tx("Skip to content")}</a>
      <OfflineBanner />
      <ConfirmHost />
      <header className="qv-topbar">
        <button
          className="qv-brand"
          onClick={() => navigate("Today")}
          aria-label={tx("Go to Qelvaris home")}
        >
          <span className="qv-brand-logo">Q</span>
          <span className="qv-brand-name">{tx("Qelvaris")}</span>
        </button>

        <nav className="qv-nav" aria-label={tx("Main navigation")}>
          {NAV.map((name) => (
            <button
              key={name}
              className={`qv-tab ${active === name ? "is-active" : ""}`}
              onClick={() => {
                /* Dropdown hata diya: Leak Lab / Openings / Games pehle section pe khulte hain */
                const first = NAV_MENUS[name] && NAV_MENUS[name][0];
                if (first) navigateToSection(name, first.section);
                else navigate(name);
              }}
              aria-current={active === name ? "page" : undefined}
            >
              {tx(name)}
            </button>
          ))}
        </nav>

        <div className="qv-right">
          {/* QV-STREAK: topbar streak badge */}
          <StreakBadge onClick={() => navigate("Today")} />
          {/* QV-QC: QC balance chip */}
          <QcChip onClick={() => navigate("Store")} />

          <button
            className={`qv-settings ${
              active === "Connect" ? "is-active" : ""
            }`}
            onClick={() => navigate("Connect")}
          >
            {tx("+ Add games")}</button>

          <button
            className={`qv-settings ${
              active === "Settings" ? "is-active" : ""
            }`}
            onClick={() => navigate("Settings")}
          >
            {tx("Settings")}</button>

          <button
            className={`qv-avatar ${
              active === "Profile" ? "is-active" : ""
            }`}
            title={tx("Open Profile")}
            aria-label={tx("Open Profile")}
            aria-current={
              active === "Profile" ? "page" : undefined
            }
            onClick={() => navigate("Profile")}
          >
            {user?.user_metadata?.display_name
              ?.charAt(0)
              ?.toUpperCase() ||
              user?.email?.charAt(0).toUpperCase() ||
              "Y"}
          </button>
        </div>
      </header>

      <main id="qv-content" tabIndex={-1} className={`qv-main ${active === NO_BACKGROUND_PAGE ? "" : "qv-main--net"}`}>
        <ErrorBoundary key={active} scope={String(active)} compact>
          <Suspense fallback={<PageFallback />}>{renderPage()}</Suspense>
        </ErrorBoundary>
      </main>

      <CelebrationHost />
      {active !== NO_BACKGROUND_PAGE && <FeedbackButton />}
      <SpeedInsights />
      <Analytics />
    </div>
  );
}

export default App;