import { useEffect, useRef, useState } from "react";
import RogueSetup from "./RogueSetup";
import RogueGameScreen from "./RogueGameScreen";
import RogueResult from "./RogueResult";
import "./rogue.css";

/* One component for the whole mode: setup -> game -> result.
   Props (all optional):
     onHome()           called by the Home button on the result screen
     onGameEnd(result)  called once when a match ends (use it to save the game, see below)
     renderPiece(p)     your own piece graphics, p = { type: "p|n|b|r|q|k", color: "w|b" }
     playerName         name shown next to the board (default "You")
     showThemeToggle    show the small light/dark button like your other boards
   It also dispatches the same window events as your other boards:
     chess:start, chess:rematch, chess:newgame, chess:home, chess:share */
const emit = (name, detail) => window.dispatchEvent(new CustomEvent("chess:" + name, { detail }));
const toggleTheme = () => {
  const r = document.documentElement;
  const dark = r.dataset.theme ? r.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  r.dataset.theme = dark ? "light" : "dark";
};

export default function RogueAIMode({ onHome, onGameEnd, renderPiece, playerName = "You", showThemeToggle = false }) {
  const [view, setView] = useState("setup");
  const [cfg, setCfg] = useState(null);
  const [result, setResult] = useState(null);
  const [round, setRound] = useState(0);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const theme = showThemeToggle ? toggleTheme : undefined;

  const start = (c) => { setCfg(c); setResult(null); setRound((n) => n + 1); setView("play"); emit("start", { mode: "rogue", ...c }); };
  const ended = (r) => { setResult(r); onGameEnd && onGameEnd(r); timer.current = setTimeout(() => setView("result"), 1100); }; // let the player see the final board

  return (
    <div className="rogue-root">
      {view === "setup" && <RogueSetup initial={cfg || {}} onStart={start} onTheme={theme} />}
      {view === "play" && cfg && (
        <RogueGameScreen key={round} config={cfg} playerName={playerName} renderPiece={renderPiece}
          onGameEnd={ended} onExit={() => { clearTimeout(timer.current); setView("setup"); }} />
      )}
      {view === "result" && result && (
        <RogueResult result={result} cfg={cfg} onTheme={theme}
          onRematch={(swap) => {
            const next = { ...cfg, playerColor: swap ? (result.playerColor === "w" ? "b" : "w") : result.playerColor };
            emit("rematch", { mode: "rogue", swapColors: swap });
            start(next);
          }}
          onNew={() => { emit("newgame", { mode: "rogue" }); setView("setup"); }}
          onHome={() => { emit("home", { mode: "rogue" }); onHome && onHome(); }} />
      )}
    </div>
  );
}
