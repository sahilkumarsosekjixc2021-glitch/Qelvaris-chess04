import { useState } from "react";
import { PERSONALITIES } from "./personalities";

const reasonText = (r) => (r === "timeout" ? "on time" : r === "resignation" ? "by resignation" : "by " + r);

function buildPgn(r) {
  const res = r.outcome === "draw" ? "1/2-1/2" : (r.outcome === "win") === (r.playerColor === "w") ? "1-0" : "0-1";
  return `[Event "Qelvaris Rogue AI"]\n[Variant "Total Chaos"]\n[Seed "${r.seed}"]\n[Result "${res}"]\n\n${r.pgn} ${res}`;
}

/* Post-match board for Rogue AI. Same look as the result card. */
export default function RogueResult({ result, cfg, onRematch, onNew, onHome, onTheme }) {
  const [swap, setSwap] = useState(true);
  const [status, setStatus] = useState("");
  const P = PERSONALITIES[result.personality] || PERSONALITIES.predator;
  const youW = result.playerColor === "w";
  const tone = result.outcome === "win" ? "var(--win)" : result.outcome === "loss" ? "var(--loss)" : "var(--draw)";
  const a = result.outcome === "win" ? 1 : result.outcome === "loss" ? 0 : 0.5;
  const left = youW ? a : 1 - a, right = 1 - left;
  const sc = (n) => (n === 0.5 ? "\u00BD" : n);
  const secs = Math.round(result.durationMs / 1000);
  const time = Math.floor(secs / 60) + ":" + String(secs % 60).padStart(2, "0");
  const meta = "Rogue AI \u00B7 " + P.name + (cfg && cfg.timeLabel ? " \u00B7 " + cfg.timeLabel : "");
  const diff = result.difficulty[0].toUpperCase() + result.difficulty.slice(1);

  const copy = () => {
    try {
      navigator.clipboard.writeText(buildPgn(result)).then(() => setStatus("PGN copied"), () => setStatus("Could not copy"));
    } catch (e) { setStatus("Could not copy"); }
  };

  return (
    <main className="rs-board">
      <div className="rs-top">
        <span className="rs-meta">{meta}</span>
        {onTheme && <button className="rs-theme" onClick={onTheme} aria-label="Switch theme">{"\u25D0"}</button>}
      </div>

      <div className="rs-res" style={{ "--tone": tone }}>
        <h1>{result.outcome === "win" ? "You won" : result.outcome === "loss" ? "You lost" : "Draw"}</h1>
        <p>{reasonText(result.reason)}</p>
      </div>

      <div className="rs-players">
        <div className="rs-pl"><span className={"rs-tile " + (youW ? "w" : "b")}>{"\u265A"}</span><div><b>You</b><small>Player</small></div></div>
        <span className="rs-score">{sc(left)} {"\u2013"} {sc(right)}</span>
        <div className="rs-pl r"><span className={"rs-tile " + (youW ? "b" : "w")}>{"\u265A"}</span><div><b>{P.name}</b><small>Rogue AI {"\u00B7"} {diff}</small></div></div>
      </div>

      <div className="rs-stats">
        <div className="rs-st"><b>{result.moveCount}</b><small>Moves</small></div>
        <div className="rs-st"><b>{time}</b><small>Time</small></div>
        <div className="rs-st"><b>{result.chaosEvents}</b><small>Chaos events</small></div>
      </div>

      <div className="rs-btns">
        <button className="rs-go" onClick={() => onRematch(swap)}>Rematch</button>
        <label className="rs-sw"><input type="checkbox" checked={swap} onChange={(e) => setSwap(e.target.checked)} /> Swap colors</label>
        <div className="rs-two">
          <button className="rs-alt" onClick={onNew}>New game</button>
          <button className="rs-alt" onClick={onHome}>Home</button>
          <button className="rs-alt wide" onClick={copy}>Copy PGN</button>
        </div>
      </div>
      <p className="rs-status" role="status">{status}</p>
    </main>
  );
}
