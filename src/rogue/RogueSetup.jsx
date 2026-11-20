import { useState } from "react";
import { PERSONALITIES, DIFFICULTIES, TIMES } from "./personalities";

/* Pre-game board for Rogue AI. Same look as the "New game" card. */
export default function RogueSetup({ initial = {}, onStart, onTheme }) {
  const [color, setColor] = useState(initial.color || "random");
  const [pers, setPers] = useState(initial.personality || "predator");
  const [diff, setDiff] = useState(initial.difficulty || "medium");
  const [time, setTime] = useState(initial.time || "5+0");

  const go = () => {
    const t = TIMES.find((x) => x[0] === time);
    const playerColor = color === "random" ? (Math.random() < 0.5 ? "w" : "b") : color === "white" ? "w" : "b";
    onStart({
      playerColor, personality: pers, difficulty: diff,
      timeControl: t[2] ? { base: t[2], inc: t[3] } : null,
      timeLabel: t[1], color, time,
    });
  };

  return (
    <main className="rs-board">
      <div className="rs-top">
        <h1>Rogue AI</h1>
        {onTheme && <button className="rs-theme" onClick={onTheme} aria-label="Switch theme">{"\u25D0"}</button>}
      </div>

      <div>
        <p className="rs-lbl">Play as</p>
        <div className="rs-colors">
          {[["white", "White", "w"], ["random", "Random", "r"], ["black", "Black", "b"]].map(([v, label, cls]) => (
            <button key={v} className="rs-pick" aria-pressed={color === v} onClick={() => setColor(v)}>
              <span className={"rs-tile " + cls}>{cls === "r" ? "?" : "\u265A"}</span>{label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="rs-lbl">Opponent</p>
        <div className="rs-opps">
          {Object.entries(PERSONALITIES).map(([k, P]) => (
            <button key={k} className="rs-opp" aria-pressed={pers === k} style={{ "--c": P.color }} onClick={() => setPers(k)}>
              <span className="rs-oav">{P.glyph}&#xFE0E;</span>
              <span className="rs-otx"><b>{P.name}</b><small>{P.tag}</small></span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="rs-lbl">Difficulty</p>
        <div className="rs-chips">
          {DIFFICULTIES.map(([v, label]) => (
            <button key={v} className="rs-chip" aria-pressed={diff === v} onClick={() => setDiff(v)}>{label}</button>
          ))}
        </div>
      </div>

      <div>
        <p className="rs-lbl">Time</p>
        <div className="rs-chips">
          {TIMES.map(([v, label]) => (
            <button key={v} className="rs-chip" aria-pressed={time === v} onClick={() => setTime(v)}>{label}</button>
          ))}
        </div>
      </div>

      <section className="rs-panel">
        <p className="rs-hint"><b>Total Chaos.</b> Now and then one piece type is picked at random. One piece of that type per side starts moving like another piece for 1 to 3 rounds. You never see it coming.</p>
      </section>

      <button className="rs-go" onClick={go}>Start game</button>
    </main>
  );
}
