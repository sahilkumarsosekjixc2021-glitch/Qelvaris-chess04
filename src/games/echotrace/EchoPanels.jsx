import { useEffect, useState } from "react";
import { PIECE_GLYPH, PIECE_NAMES } from "./echoConfig";
import { SOUND_IDENTITIES, playEchoSound } from "./echoSound";

export function PlayerPanel({ name, rating, you, active, note, capturedCount }) {
  return (
    <div className={`ec-player ${active ? "active" : ""}`}>
      <div className="ec-avatar">{you ? "\u2654" : "?"}</div>
      <div className="ec-player-info">
        <b>{name}</b>
        <small>{rating ? `Rating ${rating}` : "Unrated"}</small>
      </div>
      <div className="ec-player-note">
        <span>{note}</span>
        {capturedCount > 0 && <em>{capturedCount} captured</em>}
      </div>
    </div>
  );
}

export function TurnIndicator({ status, isMyTurn, message }) {
  const text = status.over ? status.text : isMyTurn ? "YOUR TURN" : "OPPONENT IS MOVING";
  return (
    <div className="ec-status">
      <span className={`ec-pill ${status.over ? "over" : isMyTurn ? "you" : "them"}`}>{text}</span>
      {message && <p className="ec-msg">{message}</p>}
    </div>
  );
}

export function SoundIndicator({ event, on, onToggle, reveal }) {
  const [live, setLive] = useState(false);
  useEffect(() => {
    if (!event) return undefined;
    setLive(true);
    const t = setTimeout(() => setLive(false), 1500);
    return () => clearTimeout(t);
  }, [event && event.id]); // eslint-disable-line

  return (
    <section className="ec-card">
      <div className="ec-card-head">
        <h3>Sound feedback</h3>
        <button className={`ec-toggle ${on ? "on" : ""}`} onClick={onToggle} aria-pressed={on}>{on ? "Sound on" : "Sound off"}</button>
      </div>
      <div className={`ec-sound ${live ? "live" : ""}`}>
        <div className="ec-bars">{[0, 1, 2, 3, 4].map((i) => <i key={i} style={{ animationDelay: `${i * 90}ms` }} />)}</div>
        <p>{live ? (reveal ? `Echo detected: ${PIECE_NAMES[event.piece]} sound` : "Echo detected") : "Listening for opponent moves..."}</p>
      </div>
      <div className="ec-sound-list">
        {Object.keys(SOUND_IDENTITIES).map((t) => (
          <button key={t} title={`Preview ${PIECE_NAMES[t]} sound`} onClick={() => playEchoSound(t, on)}>
            <span>{PIECE_GLYPH[t]}</span><small>{SOUND_IDENTITIES[t].label}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function Swatch({ opacity, knight }) {
  return (
    <svg viewBox="0 0 2 1" className={`ec-fp ${knight ? "ec-fp--knight" : "ec-fp--normal"}`} style={{ opacity }}>
      {knight ? (
        <>
          <circle className="ec-ring" cx=".4" cy=".5" r=".28" /><circle className="ec-ring" cx="1.6" cy=".5" r=".28" />
          <path className="ec-arc" d="M.4 .5Q1 -.3 1.6 .5" />
        </>
      ) : (
        <>
          <g className="ec-feet"><ellipse cx=".5" cy=".38" rx=".07" ry=".13" /><ellipse cx=".7" cy=".6" rx=".07" ry=".13" /></g>
          <g className="ec-feet"><ellipse cx="1.1" cy=".38" rx=".07" ry=".13" /><ellipse cx="1.3" cy=".6" rx=".07" ry=".13" /></g>
        </>
      )}
    </svg>
  );
}

export function FootprintLegend({ config }) {
  const st = config.footprints.stages;
  return (
    <section className="ec-card">
      <h3>Footprint legend</h3>
      <ul className="ec-legend">
        {st.map((s) => (
          <li key={s.name}><Swatch opacity={s.opacity} /><span><b>{s.name}</b> {s.maxAge === 0 ? "just moved" : `${s.maxAge} ply ago`}</span></li>
        ))}
        <li><Swatch knight opacity={1} /><span><b>Knight</b> jump arc, no trail</span></li>
        <li><span className="ec-gone">Gone</span><span>fully erased, no memory</span></li>
      </ul>
    </section>
  );
}

export function EchoHistory({ log, revealSquares }) {
  let you = 0;
  return (
    <section className="ec-card">
      <h3>Move &amp; echo history</h3>
      <ol className="ec-history">
        {log.length === 0 && <li className="empty">No moves yet.</li>}
        {log.map((e, i) => {
          if (e.side === "you") you += 1;
          return (
            <li key={i} className={e.side}>
              {e.side === "you" ? <><b>{you}.</b> {e.san}</> : <><span>{PIECE_GLYPH[e.piece]}</span> Echo: {PIECE_NAMES[e.piece]} sound{e.capture ? " (impact)" : ""}{revealSquares ? "" : ""}</>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function CapturedTray({ captured }) {
  const row = (list) => (list.length ? list.map((t, i) => <span key={i}>{PIECE_GLYPH[t]}</span>) : <em>none</em>);
  return (
    <section className="ec-card">
      <h3>Captured pieces</h3>
      <div className="ec-cap"><small>You captured</small><div>{row(captured.mine)}</div></div>
      <div className="ec-cap"><small>You lost</small><div>{row(captured.lost)}</div></div>
    </section>
  );
}