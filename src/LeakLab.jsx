import { useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import Board from "./Board";
import { LEAK_DEFS, computeLeaks, loadReviewedGames } from "./leaks";
import { afterMiss, afterSolve, buildQueue, comingBack, isDue, leakInfo, leakSeries, proofText, promptFor, seedTraining } from "./lab";
import { dbPut, getSetting, setSetting } from "./storage";
import "./LeakLab.css";

function goTo(page) {
  window.dispatchEvent(new CustomEvent("qelvaris-navigate", { detail: page }));
}

const tone = (status) => (status === "Fixed" ? "good" : status === "Improving" ? "warn" : "bad");

/* Pichli 10 games mein leak ki ginti: asli data se chhota line chart */
function Sparkline({ values }) {
  const w = 300;
  const h = 120;
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const pts = values.map((v, i) => [i * step, h - 10 - (v / max) * (h - 28)]);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  return (
    <svg className="ll-chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="Leak per game, last 10 games">
      <polygon points={`${line} ${w},${h} 0,${h}`} className="ll-chart-area" />
      <polyline points={line} className="ll-chart-line" vectorEffect="non-scaling-stroke" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3.2" className="ll-chart-dot" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}

const todayKey = () => new Date().toLocaleDateString("en-CA");

export default function LeakLab() {
  const [ready, setReady] = useState(false);
  const [records, setRecords] = useState([]);
  const [items, setItems] = useState([]);
  const [report, setReport] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  const [leakId, setLeakId] = useState("all");
  const [queue, setQueue] = useState([]);
  const [pos, setPos] = useState(0);
  const [requeued, setRequeued] = useState([]);

  const [phase, setPhase] = useState("idle"); // idle | solved | revealed
  const [attempts, setAttempts] = useState(0);
  const [hint, setHint] = useState(false);
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState("");
  const [daily, setDaily] = useState({ day: todayKey(), done: 0, firstTry: 0 });

  /* Games padho, positions banao, aur pehla session shuru karo */
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const loaded = await loadReviewedGames();
        const list = await seedTraining(loaded);
        const wanted = await getSetting("labLeak", null);
        const savedDaily = await getSetting("labDaily", null);
        if (!alive) return;

        const leakKey = wanted && list.some((i) => (i.leak || "other") === wanted) ? wanted : "all";
        const moment = Date.now();

        setRecords(loaded);
        setItems(list);
        setReport(computeLeaks(loaded));
        setNow(moment);
        setLeakId(leakKey);
        setQueue(buildQueue(list, leakKey, { now: moment }));
        if (savedDaily && savedDaily.day === todayKey()) setDaily(savedDaily);
        setSetting("labLeak", null).catch(() => {});
      } catch (error) {
        console.error("Leak Lab failed to load:", error);
      } finally {
        if (alive) setReady(true);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const item = items.find((entry) => entry.id === queue[pos]) || null;
  const fen = item ? item.fen : "";
  const side = item ? (item.userColor === "b" ? "Black" : "White") : "White";
  const info = leakInfo(item ? item.leak || "other" : leakId);

  const targets = useMemo(() => {
    if (!item || !selected || phase !== "idle") return [];
    try {
      return new Chess(fen).moves({ square: selected, verbose: true }).map((m) => m.to);
    } catch {
      return [];
    }
  }, [item, selected, phase, fen]);

  const entries = useMemo(() => {
    const present = new Set(items.map((entry) => entry.leak || "other"));

    return [...LEAK_DEFS.map((d) => d.id), "other"]
      .filter((id) => present.has(id))
      .map((id) => {
        const mine = items.filter((entry) => (entry.leak || "other") === id);
        const found = report ? report.leaks.find((leak) => leak.id === id) : null;
        return {
          id,
          title: leakInfo(id).title,
          status: found ? found.status : "Open",
          progress: found ? found.progress : 0,
          due: mine.filter((entry) => isDue(entry, now)).length,
          total: mine.length,
        };
      });
  }, [items, report, now]);

  const scoped = useMemo(
    () => (leakId === "all" ? items : items.filter((entry) => (entry.leak || "other") === leakId)),
    [items, leakId]
  );
  const schedule = useMemo(() => comingBack(scoped, now), [scoped, now]);
  const dueCount = scoped.filter((entry) => isDue(entry, now)).length;

  /* ---------- Session ---------- */

  function resetPosition() {
    setPhase("idle");
    setAttempts(0);
    setHint(false);
    setSelected(null);
    setMessage("");
  }

  function startSession(key, { force = false, list = items } = {}) {
    const moment = Date.now();
    setNow(moment);
    setLeakId(key);
    setQueue(buildQueue(list, key, { force, now: moment }));
    setPos(0);
    setRequeued([]);
    resetPosition();
  }

  function goNext() {
    setPos((p) => p + 1);
    resetPosition();
  }

  async function saveItem(updated) {
    setItems((list) => list.map((entry) => (entry.id === updated.id ? updated : entry)));
    setNow(Date.now());
    try {
      await dbPut("training", updated);
    } catch (error) {
      console.error("Could not save progress:", error);
    }
  }

  function bumpDaily(firstTry) {
    const base = daily.day === todayKey() ? daily : { day: todayKey(), done: 0, firstTry: 0 };
    const next = { ...base, done: base.done + 1, firstTry: base.firstTry + (firstTry ? 1 : 0) };
    setDaily(next);
    setSetting("labDaily", next).catch(() => {});
  }

  function submit(uci, san) {
    if (!item || phase !== "idle") return;

    if (uci === item.best) {
      saveItem(afterSolve(item));
      bumpDaily(attempts === 0);
      setPhase("solved");
      setMessage(`Correct: ${item.bestSan || san}. This position came from ${item.label}.`);
      return;
    }

    setAttempts((n) => n + 1);
    setMessage(
      san === item.playedSan
        ? `${san} is the move you played in the game. Look for something stronger.`
        : `${san} is not the engine's choice here. Try again, or show the answer.`
    );
  }

  function handleSquare(square) {
    if (!item || phase !== "idle") return;

    try {
      const chess = new Chess(fen);

      if (selected && targets.includes(square)) {
        const legal = chess.moves({ square: selected, verbose: true }).filter((m) => m.to === square);
        const move = legal.find((m) => !m.promotion || m.promotion === "q") || legal[0];
        if (!move) return;

        setSelected(null);
        submit(move.from + move.to + (move.promotion || ""), move.san);
        return;
      }

      const piece = chess.get(square);
      if (piece && piece.color === chess.turn() && chess.moves({ square, verbose: true }).length) setSelected(square);
      else setSelected(null);
    } catch (error) {
      console.error("Move failed:", error);
    }
  }

  function showAnswer() {
    if (!item || phase !== "idle") return;

    saveItem(afterMiss(item));
    bumpDaily(false);
    setPhase("revealed");
    setMessage(
      `The best move was ${item.bestSan || "shown on the board"}. In your game you played ${item.playedSan}. This one comes back today.`
    );

    if (!requeued.includes(item.id)) {
      setRequeued((list) => [...list, item.id]);
      setQueue((list) => [...list, item.id]);
    }
  }

  /* ---------- Screens ---------- */

  if (!ready) {
    return (
      <div className="ll-page">
        <p className="q-muted">Preparing your positions…</p>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="ll-page">
        <section className="q-card ll-blank">
          <h1 className="q-title">Leak Lab needs your games</h1>
          <p className="q-muted">
            Every position here is a mistake you really made. Add your games first, and the engine will find them.
          </p>
          <button className="q-btn q-btn--primary" onClick={() => goTo("Connect")}>
            Add games
          </button>
        </section>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="ll-page">
        <section className="q-card ll-blank">
          <h1 className="q-title">Nothing to practise yet</h1>
          <p className="q-muted">
            No repeating mistakes were found in your reviewed games. You can also add a position yourself from the Review
            page.
          </p>
          <button className="q-btn" onClick={() => goTo("Review")}>
            Open Review
          </button>
        </section>
      </div>
    );
  }

  /* "All leaks" mein proof usi leak ka dikhao jiski position abhi saamne hai */
  const proofId = leakId !== "all" ? leakId : item ? item.leak || "other" : null;
  const proofLeak = proofId ? entries.find((entry) => entry.id === proofId) : null;
  const foundLeak = proofId && report ? report.leaks.find((leak) => leak.id === proofId) : null;
  const series = proofLeak ? leakSeries(records, proofId) : [];
  const last10 = series.slice(-10);
  const trend = foundLeak ? foundLeak.trend : null;
  const finished = pos >= queue.length;
  const pct = daily.done ? Math.round((daily.firstTry / daily.done) * 100) : null;
  const maxBack = Math.max(...schedule.map((row) => row.count), 1);

  const arrow = item && phase !== "idle" && item.best ? { from: item.best.slice(0, 2), to: item.best.slice(2, 4) } : null;
  const shownSelected = selected || (hint && phase === "idle" && item ? item.best.slice(0, 2) : null);

  const nextDue = scoped.length ? Math.min(...scoped.map((entry) => entry.dueAt ?? now)) : null;
  const nextDueText =
    nextDue === null
      ? ""
      : new Date(nextDue).toDateString() === new Date(now).toDateString()
        ? "later today"
        : new Date(nextDue).toLocaleDateString();

  return (
    <div className="ll-page">
      <div className="ll-grid">
        {/* Leaks */}
        <aside className="q-card ll-leaks">
          <span className="ll-label">Your leaks</span>

          <button className={`ll-all ${leakId === "all" ? "is-on" : ""}`} onClick={() => startSession("all")}>
            <span>All leaks</span>
            <span>{items.filter((entry) => isDue(entry, now)).length} due</span>
          </button>

          {entries.map((entry) => (
            <button
              key={entry.id}
              className={`ll-leak ${leakId === entry.id ? "is-on" : ""}`}
              onClick={() => startSession(entry.id)}
              aria-pressed={leakId === entry.id}
            >
              <div className="ll-leak-top">
                <strong>{entry.title}</strong>
                <span className={`ll-pill ll-pill--${tone(entry.status)}`}>{entry.status}</span>
              </div>
              <div className="ll-leak-bar">
                <div className={`is-${tone(entry.status)}`} style={{ width: `${entry.progress}%` }} />
              </div>
              <div className="ll-leak-meta">
                <span>
                  {entry.due} due · {entry.total} {entry.total === 1 ? "position" : "positions"}
                </span>
                <strong>{entry.progress}%</strong>
              </div>
            </button>
          ))}
        </aside>

        {/* Position */}
        <section className="q-card ll-main">
          {finished || !item ? (
            <div className="ll-done">
              <h2 className="ll-h2">{queue.length ? "Session complete" : "Nothing due right now"}</h2>
              <p className="ll-muted">
                {queue.length
                  ? `You went through ${queue.length} ${queue.length === 1 ? "position" : "positions"}. Solved ones come back after 1, 3 and 7 days. Missed ones come back today.`
                  : `Nothing is waiting for ${leakId === "all" ? "any leak" : leakInfo(leakId).title.toLowerCase()}. ${nextDueText ? `The next position is due ${nextDueText}.` : ""}`}
              </p>
              <div className="ll-actions">
                <button className="ll-btn ll-btn--primary" onClick={() => startSession(leakId, { force: true })}>
                  Practise anyway
                </button>
                {dueCount > 0 && (
                  <button className="ll-btn" onClick={() => startSession(leakId)}>
                    Practise what is due ({dueCount})
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="ll-poshead">
                <span className="ll-label">
                  Position {pos + 1} of {queue.length} · From your game
                </span>
                <span className="ll-pill ll-pill--bad">{info.title}</span>
              </div>

              <div className="ll-board">
                <Board
                  fen={fen}
                  flipped={item.userColor === "b"}
                  arrow={arrow}
                  selected={shownSelected}
                  targets={targets}
                  onSquareClick={phase === "idle" ? handleSquare : null}
                />
              </div>

              <p className="ll-prompt">{promptFor(item.leak || "other", side)}</p>

              {hint && phase === "idle" && info.ask && <p className="ll-hint">{info.ask}</p>}
              {message && (
                <p className={`ll-msg ${phase === "solved" ? "is-good" : ""}`} role="status">
                  {message}
                </p>
              )}

              <div className="ll-actions">
                {phase === "idle" ? (
                  <>
                    <button className="ll-btn" onClick={() => setHint(true)} disabled={hint}>
                      Hint
                    </button>
                    <button className="ll-btn" onClick={showAnswer}>
                      Show answer
                    </button>
                    <button className="ll-btn" onClick={goNext}>
                      Skip
                    </button>
                  </>
                ) : (
                  <button className="ll-btn ll-btn--primary" onClick={goNext}>
                    {pos + 1 >= queue.length ? "Finish" : "Next position"}
                  </button>
                )}
              </div>

              <p className="ll-note">
                Only the engine&rsquo;s top move counts as correct here. <strong>{daily.done}</strong> done today
                {pct !== null && (
                  <>
                    {" "}
                    · <strong>{pct}%</strong> first try
                  </>
                )}
              </p>
            </>
          )}
        </section>

        {/* Proof + schedule */}
        <aside className="ll-side">
          <div className="q-card">
            <span className="ll-label">Proof it is working</span>

            {proofLeak ? (
              <>
                <p className="ll-small">{proofLeak.title} per game, last {last10.length} games</p>

                {last10.length >= 2 ? (
                  <Sparkline values={last10} />
                ) : (
                  <p className="ll-small">Needs at least 2 reviewed games to draw a line.</p>
                )}

                {trend ? (
                  <div className="ll-trend">
                    <span className="ll-from">{trend.before.toFixed(1)} →</span>
                    <strong className={trend.after < trend.before ? "is-good" : trend.after > trend.before ? "is-bad" : ""}>
                      {trend.after.toFixed(1)}
                    </strong>
                    <span className={`ll-pill ll-pill--${tone(proofLeak.status)}`}>
                      {trend.after < trend.before ? "Improving" : trend.after > trend.before ? "Getting worse" : "Steady"}
                    </span>
                  </div>
                ) : (
                  <p className="ll-small">Needs at least 4 reviewed games to show a trend.</p>
                )}

                <p className="ll-proof">{proofText(series, proofLeak.status)}</p>
              </>
            ) : (
              <p className="ll-small">Choose a leak on the left to see whether it is really closing.</p>
            )}

            <p className="ll-fine">Fixed is earned in real games, not in puzzles.</p>
          </div>

          <div className="q-card">
            <span className="ll-label">Coming back</span>
            <ul className="ll-schedule">
              {schedule.map((row) => (
                <li key={row.id}>
                  <span>{row.label}</span>
                  <div className="ll-back-bar" aria-hidden="true">
                    <div style={{ width: `${(row.count / maxBack) * 100}%` }} />
                  </div>
                  <strong>{row.count}</strong>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}