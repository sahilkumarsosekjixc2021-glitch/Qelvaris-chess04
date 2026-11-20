import { useEffect, useMemo, useRef, useState } from "react";
import { ChaosGame, chaosChooseMove } from "./chaosEngine";
import { PERSONALITIES } from "./personalities";
import "./rogue.css";

export { PERSONALITIES };

/* ------------------------------------------------------------------
   Rogue AI game screen (board + side panel only).
   Setup screen and result screen stay in your own files.
   Uses ./chaosEngine (Total Chaos rules: random piece transformations, custom
   move generation). requestAiMove is optional; by default the built-in chaos-aware AI plays.

   <RogueGameScreen
     config={{ playerColor:"w"|"b"|"random", personality:"predator", difficulty:"hard",
               timeControl:{ base:300, inc:0 } | null, seed?: number, chaos?: {minGap,maxGap,...} }}
     requestAiMove={optional custom async (fen, ctx) => ({ from, to, promotion })}
     onGameEnd={(result) => {}}   // show your result screen here
     onExit={() => {}}            // back to Rogue AI menu
   />

   requestAiMove ctx = { signal, personality, difficulty, history, timeControl, clocks }
   It may return { from, to, promotion }, a UCI string ("e2e4") or a SAN string.
------------------------------------------------------------------- */

const DIFF = { easy: 1, medium: 2, hard: 3, nightmare: 4 };
const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const GLYPH = { k: "\u265A", q: "\u265B", r: "\u265C", b: "\u265D", n: "\u265E", p: "\u265F" };
const FILES = "abcdefgh";
const NAMES = { p: "Pawn", n: "Knight", b: "Bishop", r: "Rook", q: "Queen" };
const AI_TIMEOUT = 20000;

const fmt = (ms) => {
  const s = Math.max(0, ms) / 1000;
  if (s < 10) return s.toFixed(1);
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return m + ":" + String(r).padStart(2, "0");
};

function normMove(res) {
  if (!res) return null;
  if (typeof res === "object") return res;
  if (/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(res))
    return { from: res.slice(0, 2), to: res.slice(2, 4), promotion: res[4] };
  return res; // SAN
}

export default function RogueGameScreen({ config = {}, requestAiMove, onGameEnd, onExit, playerName = "You", renderPiece }) {
  const personality = config.personality in PERSONALITIES ? config.personality : "predator";
  const P = PERSONALITIES[personality];
  const difficulty = config.difficulty || "medium";
  const tc = config.timeControl && config.timeControl.base ? config.timeControl : null;

  const [pc] = useState(() => config.playerColor === "w" || config.playerColor === "b" ? config.playerColor : Math.random() < 0.5 ? "w" : "b");
  const g = useRef(new ChaosGame({ seed: config.seed, config: config.chaos })).current;
  const startedAt = useRef(Date.now());
  const endedRef = useRef(false);
  const lastMsgPly = useRef(-9);
  const seen = useRef({ start: false, aLead: false, pLead: false });

  const [tick, setTick] = useState(0);
  const [status, setStatus] = useState("playing");
  const [result, setResult] = useState(null);
  const [flip, setFlip] = useState(pc === "b");
  const [sel, setSel] = useState(null);
  const [targets, setTargets] = useState([]);
  const [promo, setPromo] = useState(null);
  const [thinking, setThinking] = useState(false);
  const [err, setErr] = useState(null);
  const [retry, setRetry] = useState(0);
  const [msg, setMsg] = useState(null);
  const [confirmResign, setConfirmResign] = useState(false);
  const [times, setTimes] = useState(() => (tc ? [tc.base * 1000, tc.base * 1000] : [0, 0]));
  const listRef = useRef(null);
  const evCount = useRef(0);
  const [notes, setNotes] = useState([]);
  const [hover, setHover] = useState(null);

  const hist = g.history({ verbose: true });
  const last = hist[hist.length - 1];
  const turn = g.turn();
  const myTurn = status === "playing" && turn === pc;

  const finish = (outcome, reason) => {
    if (endedRef.current) return;
    endedRef.current = true;
    const r = { outcome, reason, plies: g.history().length, moveCount: Math.ceil(g.history().length / 2),
      durationMs: Date.now() - startedAt.current, pgn: g.pgn(), fen: g.fen(), personality, difficulty, playerColor: pc, seed: g.seed, chaosEvents: evCount.current };
    setStatus("over"); setResult(r); setThinking(false); setSel(null); setTargets([]);
    onGameEnd && onGameEnd(r);
  };

  const say = (key) => {
    const plies = g.history().length;
    if (plies - lastMsgPly.current < 4) return;
    lastMsgPly.current = plies;
    setMsg({ text: P.lines[key], id: plies });
  };

  const material = () => {
    let w = 0, b = 0;
    g.board().flat().forEach((s) => { if (s && s.type !== "k") (s.color === "w" ? (w += VAL[s.type]) : (b += VAL[s.type])); });
    return w - b;
  };

  const play = (move, who) => {
    let m;
    try { m = g.move(move); } catch (e) { return false; }
    if (!m) return false;
    if (tc && tc.inc) setTimes((t) => { const n = [...t]; n[m.color === "w" ? 0 : 1] += tc.inc * 1000; return n; });
    setSel(null); setTargets([]); setPromo(null); setErr(null); setConfirmResign(false);
    const evs = g.takeEvents();
    evCount.current += evs.filter((e) => e.kind === "start").length;
    if (evs.length) setNotes(evs.map((e, i) => ({ ...e, id: g.history().length + "-" + i })));

    if (g.isGameOver()) {
      let reason = "draw";
      if (g.isCheckmate()) { finish(who === "me" ? "win" : "loss", "checkmate"); }
      else {
        if (g.isStalemate()) reason = "stalemate";
        else if (g.isInsufficientMaterial()) reason = "insufficient material";
        else if (g.isThreefoldRepetition()) reason = "threefold repetition";
        else if (g.isDrawByFiftyMoves && g.isDrawByFiftyMoves()) reason = "fifty-move rule";
        finish("draw", reason);
      }
    } else {
      const diff = (material()) * (pc === "w" ? 1 : -1); // + means player ahead
      if (who === "ai" && !seen.current.start) { seen.current.start = true; say("start"); }
      else if (who === "me" && m.san.includes("+")) say("pCheck");
      else if (who === "ai" && m.san.includes("+")) say("aCheck");
      else if (who === "me" && m.captured) say("pCap");
      else if (who === "ai" && m.captured) say("aCap");
      else if (diff <= -3 && !seen.current.aLead) { seen.current.aLead = true; say("aLead"); }
      else if (diff >= 3 && !seen.current.pLead) { seen.current.pLead = true; say("pLead"); }
    }
    setTick((t) => t + 1);
    return true;
  };

  /* AI turn: one request at a time, cancelled when the position changes */
  useEffect(() => {
    if (status !== "playing" || g.turn() === pc) return;
    const ask = requestAiMove || ((f, c) => chaosChooseMove(g, c));
    const fen = g.fen();
    const ctl = new AbortController();
    let dead = false;
    setThinking(true); setErr(null);
    const timer = setTimeout(() => ctl.abort(), AI_TIMEOUT);
    const guard = new Promise((_, rej) => ctl.signal.addEventListener("abort", () => rej(new Error("timeout"))));
    Promise.race([
      ask(fen, { signal: ctl.signal, personality, difficulty, history: g.history(), timeControl: tc, clocks: times }),
      guard,
    ])
      .then((res) => {
        if (dead || g.fen() !== fen) return;
        if (!play(normMove(res), "ai")) setErr("The engine returned an invalid move.");
      })
      .catch((e) => { if (!dead) setErr(e.message === "timeout" ? "The engine took too long to answer." : "The engine hit an error."); })
      .finally(() => { if (!dead) setThinking(false); });
    return () => { dead = true; clearTimeout(timer); ctl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, status, retry]);

  /* Clocks run for the side to move once both sides have moved */
  useEffect(() => {
    if (!tc || status !== "playing" || g.history().length < 2) return;
    let prev = performance.now();
    const id = setInterval(() => {
      const now = performance.now(), dt = now - prev; prev = now;
      setTimes((t) => { const n = [...t]; n[g.turn() === "w" ? 0 : 1] = Math.max(0, n[g.turn() === "w" ? 0 : 1] - dt); return n; });
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, status]);

  useEffect(() => {
    if (!tc || status !== "playing") return;
    if (times[0] <= 0) finish(pc === "w" ? "loss" : "win", "timeout");
    else if (times[1] <= 0) finish(pc === "b" ? "loss" : "win", "timeout");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [times]);

  useEffect(() => { if (notes.length) { const t = setTimeout(() => setNotes([]), 7000); return () => clearTimeout(t); } }, [notes]);
  useEffect(() => { if (msg) { const t = setTimeout(() => setMsg(null), 6500); return () => clearTimeout(t); } }, [msg]);
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [tick]);

  /* board interaction */
  const select = (sq) => {
    const mv = g.moves({ square: sq, verbose: true });
    setSel(sq); setTargets(mv.map((m) => m.to));
  };
  const tryMove = (from, to) => {
    const piece = g.get(from);
    const rank = to[1];
    if (piece && piece.type === "p" && ((piece.color === "w" && rank === "8") || (piece.color === "b" && rank === "1"))) {
      if (g.moves({ square: from, verbose: true }).some((m) => m.to === to)) { setPromo({ from, to }); return; }
    }
    if (!play({ from, to }, "me")) { setSel(null); setTargets([]); }
  };
  const clickSq = (sq) => {
    if (!myTurn || promo) return;
    if (sel && targets.includes(sq)) return tryMove(sel, sq);
    const p = g.get(sq);
    if (p && p.color === pc) return select(sq);
    setSel(null); setTargets([]);
  };

  const kingSq = useMemo(() => {
    if (!g.isCheck()) return null;
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const s = g.board()[r][f];
      if (s && s.type === "k" && s.color === turn) return FILES[f] + (8 - r);
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const captured = useMemo(() => {
    const out = { w: [], b: [] }; // pieces captured BY that colour
    hist.forEach((m) => { if (m.captured) out[m.color].push(m.captured); });
    const order = "qrbnp";
    out.w.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    out.b.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);
  const lead = material() * (pc === "w" ? 1 : -1);

  const prevTo = useMemo(() => {
    if (!hover || sel) return [];
    const q = g.get(hover);
    return q && q.chaos ? g.previewMoves(hover).map((m) => m.to) : [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hover, sel, tick]);
  const active = g.activeTransformations();
  const who = (c) => (c === pc ? "Your" : "Rogue's");
  const noteText = (e) => {
    const both = e.colors.length > 1;
    return e.kind === "start"
      ? `${both ? "One " + NAMES[e.piece] + " per side" : who(e.colors[0]) + " " + NAMES[e.piece]} now moves like a ${NAMES[e.as]} for ${e.rounds} round${e.rounds > 1 ? "s" : ""}`
      : `${both ? "Both " + NAMES[e.piece] + "s return" : "The " + NAMES[e.piece] + " returns"} to normal`;
  };

  const pieceEl = (p) => renderPiece ? renderPiece(p) : (
    <span className={"rg-pc " + (p.color === "w" ? "w" : "b")}>{GLYPH[p.type]}&#xFE0E;</span>
  );

  const rows = [];
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const file = flip ? 7 - f : f, rank = flip ? r + 1 : 8 - r, sq = FILES[file] + rank;
    rows.push({ sq, dark: (file + rank) % 2 === 1, f, r, rank, file });
  }

  const pairs = [];
  hist.forEach((m, i) => { if (i % 2 === 0) pairs.push([m.san, ""]); else pairs[pairs.length - 1][1] = m.san; });

  const oppColor = pc === "w" ? "b" : "w";
  const statusText = status === "over" ? "Game over" : g.isCheck() ? (myTurn ? "You are in check" : "Rogue is in check") : myTurn ? "Your move" : thinking ? "Rogue is thinking" : "Waiting";

  const strip = (isOpp) => {
    const col = isOpp ? oppColor : pc, idx = col === "w" ? 0 : 1;
    const cap = captured[col];
    const adv = isOpp ? -lead : lead;
    return (
      <div className={"rg-strip" + (turn === col && status === "playing" ? " active" : "")}>
        <div className="rg-av" style={isOpp ? { borderColor: P.color, color: P.color } : null}>{isOpp ? P.glyph : playerName[0].toUpperCase()}</div>
        <div className="rg-who">
          <b>{isOpp ? P.name : playerName}</b>
          <span className="rg-cap">{cap.map((t, i) => <i key={i}>{GLYPH[t]}&#xFE0E;</i>)}{adv > 0 && <em>+{adv}</em>}</span>
        </div>
        {tc && <div className={"rg-clock" + (times[idx] < 30000 ? " low" : "")}>{fmt(times[idx])}</div>}
      </div>
    );
  };

  return (
    <div className="rg" style={{ "--acc": P.color }}>
      <div className="rg-main">
        {strip(true)}
        <div className="rg-boardwrap">
          <div className="rg-board">
            {rows.map(({ sq, dark, f, r, rank, file }) => {
              const p = g.get(sq);
              const ch = p && p.chaos;
              const isLast = last && (last.from === sq || last.to === sq);
              const isT = targets.includes(sq);
              const mine = p && p.color === pc;
              return (
                <div key={sq}
                  className={"rg-sq " + (dark ? "d" : "l") + (isLast ? " last" : "") + (sel === sq ? " sel" : "") + (kingSq === sq ? " chk" : "") + (ch ? " tr" : "")}
                  onMouseEnter={() => setHover(sq)} onMouseLeave={() => setHover(null)}
                  onClick={() => clickSq(sq)}
                  onDragOver={(e) => { if (isT) e.preventDefault(); }}
                  onDrop={(e) => { e.preventDefault(); if (sel && isT) tryMove(sel, sq); }}>
                  {f === 0 && <small className="rk">{rank}</small>}
                  {r === 7 && <small className="fl">{FILES[file]}</small>}
                  {p && (
                    <div className="rg-p" draggable={myTurn && mine && !promo}
                      onDragStart={(e) => { e.dataTransfer.setData("text/plain", sq); select(sq); }}>
                      {pieceEl(p)}
                    </div>
                  )}
                  {ch && <span className="rg-badge" title={"Moves like a " + NAMES[ch.as]}>{GLYPH[ch.as]}&#xFE0E;<b>{ch.roundsLeft}</b></span>}
                  {prevTo.includes(sq) && <span className={"rg-pv" + (p ? " cap" : "")} />}
                  {isT && <span className={"rg-t" + (p ? " cap" : "")} />}
                </div>
              );
            })}
            {notes.length > 0 && (
              <div className="rg-note" role="status" aria-live="polite">
                {notes.map((e) => (
                  <div key={e.id} className={e.kind}>
                    <span className="rg-chip">{e.kind === "start" ? "CHAOS" : "RESTORED"}</span>{noteText(e)}
                  </div>
                ))}
              </div>
            )}
            {promo && (
              <div className="rg-promo" role="dialog" aria-label="Choose promotion piece">
                <p>Promote to</p>
                <div>
                  {["q", "r", "b", "n"].map((t) => (
                    <button key={t} onClick={() => play({ from: promo.from, to: promo.to, promotion: t }, "me")} aria-label={t}>
                      <span className={"rg-pc " + (pc === "w" ? "w" : "b")}>{GLYPH[t]}&#xFE0E;</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        {strip(false)}
      </div>

      <aside className="rg-side">
        <div className="rg-card rg-opp">
          <div className="rg-oppTop">
            <div className="rg-av big">{P.glyph}</div>
            <div>
              <h2>{P.name}</h2>
              <p>{P.tag}</p>
            </div>
          </div>
          <div className="rg-diff" aria-label={"Difficulty " + difficulty}>
            <span>{difficulty}</span>
            {[1, 2, 3, 4].map((n) => <i key={n} className={n <= (DIFF[difficulty] || 2) ? "on" : ""} />)}
          </div>
          <div className="rg-bubble" aria-live="polite">{msg ? msg.text : "\u00A0"}</div>
        </div>

        <div className="rg-card rg-status">
          <span className={"rg-dot" + (thinking ? " pulse" : "")} />
          <b>{statusText}</b>
          {thinking && <span className="rg-dots"><i /><i /><i /></span>}
        </div>

        <div className="rg-card rg-chaos">
          <h3>Active chaos</h3>
          {active.length === 0 && <p className="none">All pieces move normally</p>}
          {active.length > 0 && (() => {
            const cs = [...new Set(active.map((t) => t.color))], t0 = active[0];
            return (
              <div className="row">
                {cs.map((c) => <span key={c} className={"sw " + c} />)}
                <span className="tx">{cs.length > 1 ? "One " + NAMES[t0.piece] + " per side" : who(cs[0]) + " " + NAMES[t0.piece]} <i>moves as a</i> {NAMES[t0.as]}</span>
                <span className="rd">{t0.roundsLeft} rd</span>
              </div>
            );
          })()}
        </div>

        {err && (
          <div className="rg-err" role="alert">
            <span>{err}</span>
            <button onClick={() => setRetry((n) => n + 1)}>Retry</button>
          </div>
        )}

        <div className="rg-card rg-moves">
          <h3>Moves</h3>
          <ol ref={listRef}>
            {pairs.length === 0 && <li className="empty">No moves yet</li>}
            {pairs.map((p, i) => (
              <li key={i} className={i === pairs.length - 1 ? "cur" : ""}><span>{i + 1}.</span><b>{p[0]}</b><b>{p[1]}</b></li>
            ))}
          </ol>
        </div>

        <div className="rg-ctl">
          <button onClick={() => setFlip((v) => !v)}>Flip board</button>
          {confirmResign ? (
            <>
              <button className="danger" onClick={() => finish("loss", "resignation")}>Confirm resign</button>
              <button onClick={() => setConfirmResign(false)}>Cancel</button>
            </>
          ) : (
            <button className="danger" disabled={status !== "playing"} onClick={() => setConfirmResign(true)}>Resign</button>
          )}
          <button onClick={onExit}>Menu</button>
        </div>
      </aside>
    </div>
  );
}
