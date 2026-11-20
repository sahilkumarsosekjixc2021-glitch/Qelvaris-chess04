import { Component, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import Board from "../Board";
import PlayBoard from "../study/PlayBoard";
import { getEngine, getEngineError, getEngineName } from "../study/engineBridge";
import { analyzePosition, initEngine } from "../study/studyEngine";
import { lineToCp } from "../study/studyScoring";
import { AI_PROFILES, DEFAULT_PROFILE_ID, OBJECTIVES, PRACTICE_POSITIONS, PRACTICE_VERSION } from "./practicePositions";
import { fmtEval, KIND, moveNumberLabel, reviewSession } from "./practiceReview";
import { loadSessions, saveSession } from "./practiceStorage";
import ChipRow from "../shell/ChipRow";
import "./PracticeArena.css";

/* ---------- Positions ek baar chess.js se verify hote hain ---------- */

function buildPositions() {
  const list = [];
  const warnings = [];

  for (const pos of PRACTICE_POSITIONS) {
    const chess = new Chess();
    let ok = true;

    for (const san of pos.line.split(" ")) {
      try {
        if (!chess.move(san)) throw new Error("illegal");
      } catch {
        ok = false;
        warnings.push(`${pos.id}: illegal move "${san}"`);
        break;
      }
    }

    if (ok && !chess.isGameOver()) list.push({ ...pos, fen: chess.fen(), turn: chess.turn() });
  }

  return { list, warnings };
}

let BUILT = null;
try {
  BUILT = buildPositions();
  if (BUILT.warnings.length) console.warn("[PracticeArena] skipped positions:", BUILT.warnings);
} catch (err) {
  console.error("[PracticeArena] build failed:", err);
}

/* ---------- Game helpers ---------- */

function endInfo(chess) {
  if (chess.isCheckmate()) return { termination: "checkmate", loser: chess.turn() };
  if (chess.isStalemate()) return { termination: "stalemate", loser: null };
  if (chess.isInsufficientMaterial()) return { termination: "insufficient_material", loser: null };
  if (chess.isThreefoldRepetition()) return { termination: "repetition", loser: null };
  if (chess.isDraw()) return { termination: "fifty_move", loser: null };
  return { termination: null, loser: null };
}

function safeReplay(startFen, moves) {
  try {
    const chess = new Chess(startFen);
    let last = null;
    for (const m of moves) {
      const from = m.uci.slice(0, 2);
      const to = m.uci.slice(2, 4);
      chess.move({ from, to, promotion: m.uci.slice(4, 5) || undefined });
      last = { from, to };
    }
    return { fen: chess.fen(), turn: chess.turn(), last, inCheck: chess.isCheck(), over: chess.isGameOver(), ...endInfo(chess) };
  } catch (err) {
    console.error("[PracticeArena] could not replay session:", err);
    return null;
  }
}

function moveChips(startFen, moves) {
  const chess = new Chess(startFen);
  const out = [];
  for (const m of moves) {
    const fenBefore = chess.fen();
    chess.move({ from: m.uci.slice(0, 2), to: m.uci.slice(2, 4), promotion: m.uci.slice(4, 5) || undefined });
    out.push({ label: moveNumberLabel(fenBefore, m.san), by: m.by });
  }
  return out;
}

const TERMINATION_TEXT = {
  checkmate: "checkmate",
  stalemate: "stalemate",
  insufficient_material: "insufficient material",
  repetition: "threefold repetition",
  fifty_move: "the fifty-move rule",
  resignation: "resignation",
};

function resultHeadline(session) {
  const how = TERMINATION_TEXT[session.termination] ? ` by ${TERMINATION_TEXT[session.termination]}` : "";
  if (session.result === "user_win") return `You won${how}.`;
  if (session.result === "user_loss") return session.termination === "resignation" ? "You resigned." : `You lost${how}.`;
  return `Draw${how}.`;
}

const OBJECTIVE_RESULT = {
  met: "Objective achieved",
  partly: "Objective partly achieved",
  not_met: "Objective not achieved",
};

const newId = () => `prs-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

/* ---------- Review view ---------- */

function ReviewView({ session }) {
  const review = session.review;
  const [focusIndex, setFocusIndex] = useState(null);
  const flipped = session.userSide === "black";
  const s = review.summary;

  const focus = focusIndex !== null ? review.moves[focusIndex] : null;
  const arrows = focus
    ? [
        { from: focus.bestUci.slice(0, 2), to: focus.bestUci.slice(2, 4), color: "#36b98a" },
        ...(focus.uci !== focus.bestUci ? [{ from: focus.uci.slice(0, 2), to: focus.uci.slice(2, 4), color: "#dc5a5a" }] : []),
      ]
    : [];

  return (
    <div className="qa-review">
      <section className="qa-card">
        <div className="qo-eyebrow">Match review</div>
        <h4>{OBJECTIVE_RESULT[s.objective]} · {OBJECTIVES[session.objective]?.label}</h4>

        <div className="qa-stats">
          <div><strong>{s.top3Pct ?? "–"}%</strong><span>Moves in the engine's top 3</span></div>
          <div><strong>{s.top1Pct ?? "–"}%</strong><span>Engine's first choice</span></div>
          <div><strong>{s.avgLoss === null ? "–" : (s.avgLoss / 100).toFixed(2)}</strong><span>Avg. pawns lost per move</span></div>
          <div><strong>{fmtEval(review.startEvalCp)}</strong><span>Start evaluation for you</span></div>
        </div>

        <div className="qa-counts">
          <span className="is-great">{s.counts.great} only moves</span>
          <span className="is-inaccuracy">{s.counts.inaccuracy} inaccuracies</span>
          <span className="is-mistake">{s.counts.mistake} mistakes</span>
          <span className="is-blunder">{s.counts.blunder} blunders</span>
        </div>
      </section>

      <section className="qa-card">
        <div className="qo-eyebrow">Coach's opinion</div>
        <div className="qa-opinion">
          {s.opinion.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </section>

      <div className="qa-review-grid">
        <section className="qa-card">
          <div className="qo-eyebrow">Your moves (click to see the engine's choice)</div>
          <ul className="qa-moves">
            {review.moves.map((m, i) => (
              <li key={`${m.label}-${i}`}>
                <button className={`qa-mv ${focusIndex === i ? "is-on" : ""}`} onClick={() => setFocusIndex(i)}>
                  <span className="qa-mv-label">{m.label}</span>
                  <span className={`qa-tag is-${m.kind}`}>{KIND[m.kind]}</span>
                  <span className="qa-mv-meta">
                    {m.isBest ? "engine's first choice" : m.inTop3 ? `top 3 · best was ${m.bestSan}` : `best was ${m.bestSan}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="qa-card">
          <div className="qo-eyebrow">{focus ? `Before ${focus.label}` : "Position"}</div>
          {focus ? (
            <>
              <div className="qa-mini-board">
                <Board fen={focus.fenBefore} flipped={flipped} arrows={arrows} showCoords />
              </div>
              <p className="qo-note">
                <span className="qa-dot is-good" /> Engine: <b>{focus.bestSan}</b> ({fmtEval(focus.bestCp)})
                {focus.uci !== focus.bestUci && (
                  <>
                    {" · "}
                    <span className="qa-dot is-bad" /> You: <b>{focus.san}</b> ({fmtEval(focus.playedCp)})
                  </>
                )}
              </p>
              <p className="qo-note">Engine's top 3: {focus.topSans.join(", ")}.</p>
            </>
          ) : (
            <p className="qo-note">Pick one of your moves on the left to see the position and the engine's arrow.</p>
          )}
        </section>
      </div>
    </div>
  );
}

/* ---------- Match ---------- */

function Match({ session, profile, onChange, onExit, onRestart }) {
  const userColor = session.userSide === "white" ? "w" : "b";
  const game = useMemo(() => safeReplay(session.startFen, session.moves), [session.startFen, session.moves]);
  const chips = useMemo(() => {
    try {
      return moveChips(session.startFen, session.moves);
    } catch {
      return [];
    }
  }, [session.startFen, session.moves]);

  const sessionRef = useRef(session);
  sessionRef.current = session;

  // sessionRef turant badalta hai, taaki do async updates ek doosre ko overwrite na karein
  function commit(next) {
    sessionRef.current = next;
    onChange(next);
  }

  const [thinking, setThinking] = useState(false);
  const [aiError, setAiError] = useState("");
  const [retry, setRetry] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [progress, setProgress] = useState(null);
  const [reviewError, setReviewError] = useState("");
  const [hint, setHint] = useState([]);
  const [hintBusy, setHintBusy] = useState(false);

  // Nayi chaal ke baad purana hint hat jaata hai
  useEffect(() => {
    setHint([]);
  }, [session.moves.length]);

  const done = session.status !== "in_progress";
  const userTurn = Boolean(game) && !done && !game.over && game.turn === userColor;
  const aiTurn = Boolean(game) && !done && !game.over && game.turn !== userColor;

  // Game khatam hua (mate/draw) toh session complete karo
  useEffect(() => {
    if (!game || done || !game.over) return;
    const result = game.termination === "checkmate" ? (game.loser === userColor ? "user_loss" : "user_win") : "draw";
    commit({
      ...sessionRef.current,
      status: "completed",
      result,
      termination: game.termination,
      completedAt: new Date().toISOString(),
    });
  }, [game, done, userColor]);

  // Engine ki starting evaluation (user ke nazariye se)
  useEffect(() => {
    if (session.startEvalCp !== undefined) return undefined;
    let alive = true;
    analyzePosition(session.startFen, { multipv: 1, depth: 10 })
      .then((res) => {
        if (!alive || !res.lines.length) return;
        const cp = lineToCp(res.lines[0]);
        const stm = new Chess(session.startFen).turn();
        commit({ ...sessionRef.current, startEvalCp: stm === userColor ? cp : -cp });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // AI ki chaal
  useEffect(() => {
    if (!aiTurn) return undefined;
    let cancelled = false;
    setThinking(true);
    setAiError("");

    (async () => {
      try {
        const engine = await getEngine();
        if (!engine) throw new Error("no engine");
        const uci = await engine.bestMove(game.fen, { movetime: profile.movetime, skill: profile.skill });
        if (cancelled) return;
        if (!uci) {
          setThinking(false);
          setAiError("The engine returned no move.");
          return;
        }
        const chess = new Chess(game.fen);
        const mv = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.slice(4, 5) || undefined });
        setThinking(false);
        commit({
          ...sessionRef.current,
          moves: [...sessionRef.current.moves, { uci, san: mv.san, by: "ai" }],
        });
      } catch (err) {
        console.error("[PracticeArena] engine move failed:", err);
        if (!cancelled) {
          setThinking(false);
          setAiError("The engine could not move. Try again.");
        }
      }
    })();

    return () => {
      cancelled = true;
      setThinking(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiTurn, session.moves.length, retry]);

  function onUserMove(m) {
    onChange({ ...session, moves: [...session.moves, { uci: m.uci, san: m.san, by: "user" }] });
  }

  const HINT_LIMIT = 3;
  const hintsUsed = session.hints || 0;

  async function showHint() {
    if (!userTurn || hintBusy || hintsUsed >= HINT_LIMIT) return;
    setHintBusy(true);
    try {
      const res = await analyzePosition(game.fen, { multipv: 1, depth: 9 });
      const best = res.lines[0]?.pv[0];
      if (best) {
        setHint([{ from: best.slice(0, 2), to: best.slice(2, 4), color: "#58c4f2" }]);
        commit({ ...sessionRef.current, hints: (sessionRef.current.hints || 0) + 1 });
      }
    } catch (err) {
      console.error("[PracticeArena] hint failed:", err);
    } finally {
      setHintBusy(false);
    }
  }

  function undo() {
    let idx = -1;
    for (let i = session.moves.length - 1; i >= 0; i -= 1) {
      if (session.moves[i].by === "user") {
        idx = i;
        break;
      }
    }
    if (idx < 0) return;
    onChange({ ...session, moves: session.moves.slice(0, idx), undoCount: (session.undoCount || 0) + 1 });
  }

  function resign() {
    onChange({
      ...session,
      status: "completed",
      result: "user_loss",
      termination: "resignation",
      completedAt: new Date().toISOString(),
    });
  }

  async function runReview() {
    setReviewing(true);
    setReviewError("");
    setProgress(null);
    try {
      const ready = await initEngine();
      if (!ready) throw new Error("engine missing");
      const review = await reviewSession(sessionRef.current, (k, n) => setProgress({ k, n }), getEngineName());
      commit({ ...sessionRef.current, review });
    } catch (err) {
      console.error("[PracticeArena] review failed:", err);
      setReviewError("The review could not be made. Check that the engine is working and try again.");
    } finally {
      setReviewing(false);
    }
  }

  if (!game) {
    return (
      <div className="qo-empty">
        <h3>This session could not be loaded</h3>
        <p>Its saved moves are not valid.</p>
        <button className="qo-btn" onClick={onExit}>← Back</button>
      </div>
    );
  }

  const objective = OBJECTIVES[session.objective];
  const hasUserMove = session.moves.some((m) => m.by === "user");
  const flipped = session.userSide === "black";

  return (
    <div className="qa-match">
      <div className="qa-top">
        <div>
          <div className="qo-eyebrow">{objective?.label} · you play {session.userSide} · AI: {profile.name}</div>
          <h3>{session.title}</h3>
          <p>{objective?.goal}</p>
        </div>
        <button className="qo-btn" onClick={onExit}>← All positions</button>
      </div>

      <div className="qa-layout">
        <div className="qa-board">
          <PlayBoard
            fen={game.fen}
            flipped={flipped}
            lastMove={game.last}
            locked={!userTurn}
            onMove={onUserMove}
            arrows={hint}
          />
          <div className="qa-status">
            {done && <b>{resultHeadline(session)}</b>}
            {!done && userTurn && <span>Your move{game.inCheck ? " · you are in check" : ""}.</span>}
            {!done && aiTurn && !aiError && <span>Engine is thinking…</span>}
            {!done && aiError && (
              <span>
                {aiError} <button className="qa-link" onClick={() => setRetry((n) => n + 1)}>Retry</button>
              </span>
            )}
          </div>
        </div>

        <div className="qa-panel">
          <section className="qa-card">
            <div className="qo-eyebrow">Game</div>
            <ul className="qa-facts">
              <li><b>Start evaluation:</b> {session.startEvalCp === undefined ? "checking…" : `${fmtEval(session.startEvalCp)} for you`}</li>
              <li><b>Moves played:</b> {session.moves.length} plies{thinking ? " · engine thinking" : ""}</li>
              {hintsUsed > 0 && <li><b>Hints used:</b> {hintsUsed}</li>}
            </ul>

            <div className="qa-chips">
              {chips.length === 0 && <span className="qo-meta">No moves yet.</span>}
              {chips.map((c, i) => (
                <span key={`${c.label}-${i}`} className={`qa-chip is-${c.by}`}>{c.label}</span>
              ))}
            </div>

            {!done && (
              <div className="qa-actions">
                <button className="qo-btn" disabled={!userTurn || hintBusy || hintsUsed >= HINT_LIMIT} onClick={showHint}>
                  {hintBusy ? "Thinking…" : `Hint (${HINT_LIMIT - hintsUsed} left)`}
                </button>
                <button className="qo-btn" disabled={!hasUserMove} onClick={undo}>Undo my last move</button>
                <button className="qo-btn" onClick={onRestart}>Restart</button>
                <button className="qo-btn" onClick={resign}>Resign</button>
              </div>
            )}
          </section>

          {done && (
            <section className="qa-card">
              <div className="qo-eyebrow">Result</div>
              <h4>{resultHeadline(session)}</h4>

              {!session.review && (
                <>
                  <p className="qo-note">
                    The engine will check each of your moves against its top 3 choices. This can take up to a minute.
                  </p>
                  <button className="qo-btn qo-btn--primary" disabled={reviewing || !hasUserMove} onClick={runReview}>
                    {reviewing ? (progress ? `Analysing move ${progress.k} of ${progress.n}…` : "Starting analysis…") : "Analyse my game"}
                  </button>
                  {!hasUserMove && <p className="qo-note">There is nothing to analyse yet because you did not play a move.</p>}
                  {reviewError && <p className="qa-error">{reviewError}</p>}
                </>
              )}

              <div className="qa-actions">
                <button className="qo-btn" onClick={onRestart}>Play again</button>
                <button className="qo-btn" onClick={onExit}>Other positions</button>
              </div>
            </section>
          )}
        </div>
      </div>

      {done && session.review && <ReviewView session={session} />}
    </div>
  );
}

/* ---------- Arena (list) ---------- */

class Guard extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err) {
    console.error("[PracticeArena] crashed:", err);
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="qo-empty">
          <h3>Match Arena could not load</h3>
          <p>The rest of your Openings page is not affected.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

const PAGE_SIZE = 9;
const LEVEL_ORDER = ["Beginner", "Developing", "Intermediate", "Advanced", "Expert"];

const profileById = (id) => AI_PROFILES.find((p) => p.id === id) || AI_PROFILES.find((p) => p.id === DEFAULT_PROFILE_ID);
const dateText = (iso) => (iso ? new Date(iso).toLocaleDateString() : "");

function ArenaInner({ startPositionId }) {
  const [engine, setEngine] = useState("checking");
  const [engineName, setEngineName] = useState("");
  const [sessions, setSessions] = useState([]);
  const [active, setActive] = useState(null);
  const focusPos = startPositionId ? BUILT.list.find((p) => p.id === startPositionId) || null : null;
  const [profileId, setProfileId] = useState(DEFAULT_PROFILE_ID);
  const [sideChoice, setSideChoice] = useState("auto");
  const [openingFilter, setOpeningFilter] = useState(focusPos?.opening || "All");
  const [levelFilter, setLevelFilter] = useState("All");
  const [page, setPage] = useState(() => {
    if (!focusPos) return 0;
    const same = BUILT.list.filter((p) => p.opening === focusPos.opening);
    return Math.floor(Math.max(0, same.findIndex((p) => p.id === focusPos.id)) / PAGE_SIZE);
  });

  useEffect(() => {
    let alive = true;
    loadSessions().then((list) => alive && setSessions(list));
    initEngine().then((ok) => {
      if (!alive) return;
      setEngine(ok ? "ready" : "off");
      setEngineName(ok ? getEngineName() : "");
    });
    return () => {
      alive = false;
    };
  }, []);

  function update(next) {
    setActive(next);
    setSessions((prev) => (prev.some((s) => s.id === next.id) ? prev.map((s) => (s.id === next.id ? next : s)) : [...prev, next]));
    saveSession(next).catch((err) => console.error("Could not save session:", err));
  }

  function create(pos, side, pid) {
    const session = {
      id: newId(),
      positionId: pos.id,
      positionVersion: PRACTICE_VERSION,
      title: pos.title,
      objective: pos.objective,
      startFen: pos.fen,
      userSide: side,
      profileId: pid,
      moves: [],
      status: "in_progress",
      startedAt: new Date().toISOString(),
      undoCount: 0,
    };
    update(session);
  }

  function start(pos) {
    const side = sideChoice === "auto" ? (pos.turn === "w" ? "white" : "black") : sideChoice;
    create(pos, side, profileId);
  }

  function restart(session) {
    const pos = BUILT.list.find((p) => p.id === session.positionId);
    if (!pos) {
      setActive(null);
      return;
    }
    if (session.status === "in_progress" && session.moves.length > 0) {
      const abandoned = { ...session, status: "abandoned" };
      setSessions((prev) => prev.map((s) => (s.id === abandoned.id ? abandoned : s)));
      saveSession(abandoned).catch(() => {});
    }
    create(pos, session.userSide, session.profileId);
  }

  function discard(session) {
    const abandoned = { ...session, status: "abandoned" };
    setSessions((prev) => prev.map((s) => (s.id === abandoned.id ? abandoned : s)));
    saveSession(abandoned).catch(() => {});
  }

  if (active) {
    return (
      <Match
        key={active.id}
        session={active}
        profile={profileById(active.profileId)}
        onChange={update}
        onExit={() => setActive(null)}
        onRestart={() => restart(active)}
      />
    );
  }

  const resumable = [...sessions].reverse().find((s) => s.status === "in_progress" && s.moves.length > 0);
  const finished = [...sessions].reverse().filter((s) => s.status === "completed").slice(0, 5);
  const profile = profileById(profileId);
  const openingItems = [];
  for (const p of BUILT.list) {
    if (!p.opening) continue;
    const row = openingItems.find((o) => o.name === p.opening);
    if (row) row.count += 1;
    else openingItems.push({ name: p.opening, count: 1 });
  }
  const levelList = LEVEL_ORDER.filter((l) => BUILT.list.some((p) => p.difficulty === l));
  const visiblePositions = BUILT.list.filter(
    (p) => (openingFilter === "All" || p.opening === openingFilter) && (levelFilter === "All" || p.difficulty === levelFilter)
  );
  const pages = Math.max(1, Math.ceil(visiblePositions.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const pageItems = visiblePositions.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const doneCount = new Set(sessions.filter((s) => s.status === "completed").map((s) => s.positionId)).size;
  const sideLabel = sideChoice === "auto" ? "Auto" : sideChoice === "white" ? "White" : "Black";

  return (
    <div className="qa-home">
      {engine === "off" && (
        <p className="qa-banner is-bad">
          No engine could be started{getEngineError() ? ` (${getEngineError()})` : ""}, so matches cannot start. Open the browser
          console (F12) and send me what it says.
        </p>
      )}
      {engine === "ready" && engineName !== "Stockfish" && (
        <p className="qa-banner">
          Playing against the {engineName.toLowerCase()}. It is much weaker than Stockfish, so even "Maximum" is beatable.
          Connect Stockfish for a stronger opponent (see README.txt).
        </p>
      )}

      {resumable && (
        <section className="qa-resume">
          <div className="qa-resume-text">
            <span className="qa-kicker">Unfinished game</span>
            <b>{resumable.title}</b>
            <span className="qo-meta">{resumable.moves.length} plies · {dateText(resumable.startedAt)}</span>
          </div>
          <div className="qa-actions">
            <button className="qa-go" disabled={engine !== "ready"} onClick={() => setActive(resumable)}>Resume</button>
            <button className="qa-ghost" onClick={() => discard(resumable)}>Discard</button>
          </div>
        </section>
      )}

      <div className="qa-split">
        <aside className="qa-setup-card" aria-label="Match setup">
          <div className="qa-setup-head">
            <h3>Match setup</h3>
            <span className={`qa-engine is-${engine}`}>
              <i /> {engine === "ready" ? engineName || "Engine ready" : engine === "off" ? "Engine off" : "Starting engine…"}
            </span>
          </div>

          <div className="qa-field" role="radiogroup" aria-label="AI strength">
            <span className="qa-kicker">AI strength</span>
            <div className="qa-levels4">
              {AI_PROFILES.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={profileId === p.id}
                  className={`qa-lv ${profileId === p.id ? "is-on" : ""}`}
                  onClick={() => setProfileId(p.id)}
                >
                  <span className="qa-bars" aria-hidden="true">
                    {[0, 1, 2, 3].map((n) => (
                      <i key={n} className={n <= i ? "on" : ""} />
                    ))}
                  </span>
                  <b>{p.name}</b>
                </button>
              ))}
            </div>
            <p className="qa-hint">{profile.note} Levels are not calibrated to ratings yet.</p>
          </div>

          <div className="qa-field" role="radiogroup" aria-label="You play">
            <span className="qa-kicker">You play</span>
            <div className="qa-seg">
              {[["auto", "Side to move"], ["white", "White"], ["black", "Black"]].map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={sideChoice === v}
                  className={sideChoice === v ? "is-on" : ""}
                  onClick={() => setSideChoice(v)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="qa-stats3">
            <div><strong>{BUILT.list.length}</strong><span>positions</span></div>
            <div><strong>{doneCount}</strong><span>finished</span></div>
            <div><strong>{sideLabel}</strong><span>you play</span></div>
          </div>

          {focusPos && (
            <div className="qa-focus">
              <span className="qa-kicker">From your lesson</span>
              <b>{focusPos.title}</b>
              <span className="qo-meta">{focusPos.opening} · {focusPos.turn === "w" ? "White" : "Black"} to move</span>
              <button className="qa-go qa-go--wide" disabled={engine !== "ready"} onClick={() => start(focusPos)}>
                Start this match →
              </button>
            </div>
          )}
        </aside>

        <section className="qa-positions" aria-label="Positions">
          <ChipRow
            items={openingItems}
            total={BUILT.list.length}
            value={openingFilter}
            onChange={(name) => {
              setOpeningFilter(name);
              setPage(0);
            }}
            visible={4}
          />

          <div className="qa-filterbar">
            <div className="ld-seg" role="group" aria-label="Level">
              {["All", ...levelList].map((l) => (
                <button
                  key={l}
                  type="button"
                  className={levelFilter === l ? "is-on" : ""}
                  aria-pressed={levelFilter === l}
                  onClick={() => {
                    setLevelFilter(l);
                    setPage(0);
                  }}
                >
                  {l === "All" ? "All levels" : l}
                </button>
              ))}
            </div>
            <span className="qa-count">
              {visiblePositions.length} {visiblePositions.length === 1 ? "position" : "positions"}
            </span>
          </div>

          {visiblePositions.length === 0 && (
            <div className="qo-empty">
              <h3>No positions match these filters</h3>
              <p>Try another opening or level.</p>
            </div>
          )}

          <div className="qa-grid">
            {pageItems.map((pos) => (
              <article className={`qa-pcard ${focusPos?.id === pos.id ? "is-focus" : ""}`} key={pos.id}>
                <div className="qa-ptop">
                  <span className="qa-diff">{pos.difficulty}</span>
                  <span className="qa-side">
                    <i className={pos.turn === "w" ? "is-w" : "is-b"} aria-hidden="true" />
                    {pos.turn === "w" ? "White" : "Black"} to move
                  </span>
                </div>
                <div className="qa-pthumb" aria-hidden="true">
                  <Board fen={pos.fen} flipped={pos.turn === "b"} showCoords={false} />
                </div>
                <div className="qa-ptext">
                  {pos.opening && <span className="qa-popen">{pos.opening}</span>}
                  <h4>{pos.title}</h4>
                  <p>{pos.blurb}</p>
                </div>
                <div className="qa-pfoot">
                  <span className="qa-goal">{OBJECTIVES[pos.objective].label}</span>
                  <button className="qa-go" disabled={engine !== "ready"} onClick={() => start(pos)}>Play →</button>
                </div>
              </article>
            ))}
          </div>

          {pages > 1 && (
            <div className="ld-pager qa-pager" role="navigation" aria-label="Pages">
              <button type="button" aria-label="Previous page" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>‹</button>
              {Array.from({ length: pages }, (_, i) => (
                <button key={i} type="button" className={i === safePage ? "is-on" : ""} aria-current={i === safePage ? "page" : undefined} onClick={() => setPage(i)}>
                  {i + 1}
                </button>
              ))}
              <button type="button" aria-label="Next page" disabled={safePage >= pages - 1} onClick={() => setPage(safePage + 1)}>›</button>
            </div>
          )}

          {BUILT.list.length === 0 && <div className="qo-empty">No valid positions found.</div>}

          {finished.length > 0 && (
            <section className="qa-history">
              <span className="qa-kicker">Recent games</span>
              <ul>
                {finished.map((s) => (
                  <li key={s.id}>
                    <span>
                      <b>{s.title}</b>
                      <span className="qo-meta"> · {resultHeadline(s)} {dateText(s.completedAt)}</span>
                    </span>
                    <button className="qa-link" onClick={() => setActive(s)}>{s.review ? "View review" : "Open"}</button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </section>
      </div>
    </div>
  );
}

export default function PracticeArena({ startPositionId = "" }) {
  if (!BUILT) {
    return <div className="qo-empty"><h3>Match Arena data could not be built</h3></div>;
  }
  return (
    <Guard>
      <ArenaInner key={startPositionId} startPositionId={startPositionId} />
    </Guard>
  );
}
