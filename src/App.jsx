
import { useEffect, useState } from "react";

import OpeningStudio from "./OpeningStudio";
import Puzzles from "./Puzzles";
import PlayChess from "./PlayChess";
import AnalysisLab from "./AnalysisLab";
import GameReview from "./GameReview";
import ChessCoach from "./ChessCoach";
import ProgressIntelligence from "./ProgressIntelligence";

import "./App.css";

const menuItems = [
  { name: "Dashboard", icon: "⌂" },
  { name: "Play Chess", icon: "♟" },
  { name: "Analysis Lab", icon: "⌕" },
  { name: "Game Review", icon: "▤" },
  { name: "Puzzles", icon: "♜" },
  { name: "Opening Studio", icon: "♞" },
  { name: "Progress Intelligence", icon: "↗" },
  { name: "Chess Coach", icon: "✦" },
];

function App() {
  const [active, setActive] = useState("Dashboard");

  
useEffect(() => {
  const goDashboard = () => setActive("Dashboard");

  const navigateToPage = (event) => {
    const page = event.detail;

    const allowedPages = [
      "Dashboard",
      "Play Chess",
      "Analysis Lab",
      "Game Review",
      "My Progress",
      "Puzzles",
      "Opening Studio",
      "Progress Intelligence",
      "Chess Coach",
    ];

    if (allowedPages.includes(page)) {
      setActive(page === "My Progress" ? "Game Review" : page);
    }
  };

  window.addEventListener("qelvaris-dashboard", goDashboard);
  window.addEventListener("qelvaris-navigate", navigateToPage);

  return () => {
    window.removeEventListener("qelvaris-dashboard", goDashboard);
    window.removeEventListener("qelvaris-navigate", navigateToPage);
  };
}, []);

  function renderPage() {
    switch (active) {
      case "Play Chess":
        return <PlayChess />;

      case "Analysis Lab":
        return <AnalysisLab />;

      case "Game Review":
        return <GameReview />;

      case "Puzzles":
        return <Puzzles />;

      case "Opening Studio":
        return <OpeningStudio />;

      case "Progress Intelligence":
        return <ProgressIntelligence />;

      case "Chess Coach":
        return <ChessCoach />;

      default:
        return (
          <section className="page-content">
            <p className="eyebrow">QELVARIS CHESS PLATFORM</p>

            <h1>Build Your Chess Intelligence.</h1>

            <p>
              Play, analyse, learn from your mistakes and build a
              stronger chess routine with one connected workspace.
            </p>

            <div className="dashboard-actions">
              <button onClick={() => setActive("Play Chess")}>
                Play Chess →
              </button>

              <button
                className="secondary-button"
                onClick={() => setActive("Analysis Lab")}
              >
                Open Analysis Lab
              </button>
            </div>

            <div className="dashboard-cards">
              {[
                {
                  name: "Analysis Lab",
                  icon: "⌕",
                  description:
                    "Explore positions, candidate moves and engine lines.",
                },
                {
                  name: "Game Review",
                  icon: "▤",
                  description:
                    "Review saved games and identify critical moments.",
                },
                {
                  name: "Chess Coach",
                  icon: "✦",
                  description:
                    "Turn your game history into practical learning goals.",
                },
                {
                  name: "Progress Intelligence",
                  icon: "↗",
                  description:
                    "Track game history and discover performance trends.",
                },
                {
                  name: "Puzzles",
                  icon: "♜",
                  description:
                    "Practise tactical patterns and calculate variations.",
                },
                {
                  name: "Opening Studio",
                  icon: "♞",
                  description:
                    "Organise opening lines and study your repertoire.",
                },
              ].map((item) => (
                <button
                  key={item.name}
                  className="dashboard-card"
                  onClick={() => setActive(item.name)}
                >
                  <span className="card-icon">{item.icon}</span>
                  <h3>{item.name}</h3>
                  <p>{item.description}</p>
                </button>
              ))}
            </div>
          </section>
        );
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">Q</div>
          <div>
            <h2>QELVARIS</h2>
            <span>CHESS PLATFORM</span>
          </div>
        </div>

        <p className="menu-label">WORKSPACE</p>

        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <button
              key={item.name}
              className={`nav-item ${
                active === item.name ? "active" : ""
              }`}
              onClick={() => setActive(item.name)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.name}</span>

              {active === item.name && (
                <span className="active-dot" />
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="footer-piece">♞</div>
          <div>
            <strong>Think. Play. Improve.</strong>
            <p>Your game, your journey.</p>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <span className="breadcrumb">QELVARIS</span>
            <span className="breadcrumb-separator"> / </span>
            <span className="current-page">{active}</span>
          </div>

          <div className="topbar-status">
            <span className="status-dot" />
            Chess workspace
          </div>
        </header>

        {renderPage()}
      </main>
    </div>
  );
}

export default App;
