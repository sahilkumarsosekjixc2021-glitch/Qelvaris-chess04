import { Component, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import Board from "../Board";
import {
  EVAL_LEVELS,
  FACTORS,
  PLANS,
  STUDY_CONTENT_VERSION,
  STUDY_EXERCISES,
} from "./studyPositions";
import { analyzePosition, initEngine } from "./studyEngine";
import PlayBoard from "./PlayBoard";
import { getEngineName } from "./engineBridge";
import { lineToCp, scoreAttempt } from "./studyScoring";
import { clearDraft, loadAttempts, loadDraft, saveAttempt, saveDraft } from "./studyStorage";
import "./StudyLab.css";

/* ---------- Exercises ek baar chess.js se verify hote hain ---------- */

function buildExercises() {
  const exercises = [];
  const warnings = [];

  for (const ex of STUDY_EXERCISES) {
    const chess = new Chess();
    let ok = true;

    for (const san of ex.line.split(" ")) {
      try {
        if (!chess.move(san)) throw new Error("illegal");
      } catch {
        ok = false;
        warnings.push(`${ex.id}: illegal move "${san}"`);
        break;
      }
    }

    if (!ok) continue;

    const last = chess.history({ verbose: true }).pop();
    exercises.push({
      ...ex,
      fen: chess.fen(),
      turn: chess.turn(),
      lastMove: last ? { from: last.from, to: last.to } : null,
    });
  }

  return { exercises, warnings };
}

let BUILT = null;
try {
  BUILT = buildExercises();
  if (BUILT.warnings.length) console.warn("[StudyLab] skipped exercises:", BUILT.warnings);
} catch (err) {
  console.error("[StudyLab] build failed:", err);
}

/* ---------- Helpers ---------- */

const VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9 };

function materialText(fen) {
  let white = 0;
  let black = 0;
  for (const ch of fen.split(" ")[0]) {
    const v = VALUES[ch.toLowerCase()];
    if (!v) continue;
    if (ch === ch.toUpperCase()) white += v;
    else black += v;
  }
  const diff = white - black;
  if (diff === 0) return "Material is equal";
  return diff > 0 ? `White is up ${diff}` : `Black is up ${-diff}`;
}

function replay(startFen, moves) {
  const chess = new Chess(startFen);
  let last = null;
  for (const m of moves) {
    chess.move({ from: m.from, to: m.to, promotion: m.promotion });
    last = { from: m.from, to: m.to };
  }
  return { fen: chess.fen(), last, over: chess.isGameOver() };
}

function formatLine(startFen, moves) {
  const parts = startFen.split(" ");
  let turn = parts[1];
  let num = Number(parts[5]) || 1;
  const out = [];

  moves.forEach((m, i) => {
    if (turn === "w") out.push(`${num}.${m.san}`);
    else out.push(i === 0 ? `${num}…${m.san}` : m.san);
    if (turn === "b") num += 1;
    turn = turn === "w" ? "b" : "w";
  });

  return out.join(" ");
}

function uciToSan(fen, uci) {
  try {
    const chess = new Chess(fen);
    const m = chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.slice(4, 5) || undefined,
    });
    return m ? m.san : uci;
  } catch {
    return uci;
  }
}

function fmtCp(cp) {
  if (cp === null || cp === undefined) return "–";
  if (Math.abs(cp) >= 9000) return cp > 0 ? "mate for you" : "mate against";
  const v = (cp / 100).toFixed(2);
  return cp > 0 ? `+${v}` : v;
}

const makeId = (exerciseId) => `${exerciseId}-${Date.now()}`;

/* ---------- Exercise runner ---------- */

const STAGES = ["Evaluate", "Candidates", "Calculate", "Compare"];

function Runner({ ex, draft, onExit, onSaved, onRestart }) {
  const [stage, setStage] = useState(draft?.stage ?? 0);
  const [attemptId] = useState(() => makeId(ex.id));
  const [startedAt] = useState(() => new Date().toISOString());

  const [assessment, setAssessment] = useState(draft?.assessment ?? "");
  const [factor, setFactor] = useState(draft?.factor ?? "");
  const [threat, setThreat] = useState(draft?.threat ?? "");

  const [pending, setPending] = useState(null);
  const [lines, setLines] = useState(draft?.lines ?? []); // [{ moves: [...] }]
  const [active, setActive] = useState(draft?.active ?? 0);
  const [plan, setPlan] = useState(draft?.plan ?? "");

  const [result, setResult] = useState({ status: "idle" });
  const submittedRef = useRef(false);

  // Progress apne aap save hota hai, taaki refresh ya wapas aane par wahin se shuru ho
  useEffect(() => {
    if (stage >= 3) return;
    const started = assessment || factor || threat || plan || lines.length || stage;
    if (!started) return;
    saveDraft({ exerciseId: ex.id, stage, assessment, factor, threat, lines, plan, active }).catch(() => {});
  }, [stage, assessment, factor, threat, lines, plan, active, ex.id]);

  const flipped = ex.turn === "b";

  // Board par kya dikhega
  const view = useMemo(() => {
    if (stage === 0) return { fen: ex.fen, last: ex.lastMove };
    if (stage === 1) {
      if (pending) {
        const r = replay(ex.fen, [pending]);
        return { fen: r.fen, last: r.last };
      }
      return { fen: ex.fen, last: ex.lastMove };
    }
    if (stage === 2) {
      const moves = lines[active]?.moves || [];
      const r = replay(ex.fen, moves);
      return { fen: r.fen, last: r.last, over: r.over };
    }
    return { fen: ex.fen, last: ex.lastMove };
  }, [stage, pending, lines, active, ex]);

  function onMoveStage1(move) {
    if (pending || lines.length >= 3) return;
    setPending(move);
  }

  function savePending() {
    if (!pending) return;
    if (lines.some((l) => l.moves[0].uci === pending.uci)) {
      setPending(null);
      return;
    }
    setLines((prev) => [...prev, { moves: [pending] }]);
    setPending(null);
  }

  function removeLine(index) {
    setLines((prev) => prev.filter((_, i) => i !== index));
    setActive(0);
  }

  function onMoveStage2(move) {
    const line = lines[active];
    if (!line || line.moves.length >= 6 || view.over) return;
    setLines((prev) =>
      prev.map((l, i) => (i === active ? { moves: [...l.moves, move] } : l))
    );
  }

  function undoStage2() {
    setLines((prev) =>
      prev.map((l, i) =>
        i === active && l.moves.length > 1 ? { moves: l.moves.slice(0, -1) } : l
      )
    );
  }

  async function submit() {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setStage(3);

    const base = {
      id: attemptId,
      exerciseId: ex.id,
      exerciseVersion: STUDY_CONTENT_VERSION,
      status: "completed",
      startedAt,
      completedAt: new Date().toISOString(),
      startFen: ex.fen,
      initialEvaluation: { assessment, factor, notes: threat.trim() || undefined },
      selectedPlan: plan,
      candidateLines: lines.map((l, i) => ({
        candidateIndex: i,
        firstMoveUci: l.moves[0].uci,
        moveUci: l.moves.map((m) => m.uci),
        moveSan: l.moves.map((m) => m.san),
        finalFen: replay(ex.fen, l.moves).fen,
      })),
    };

    let metrics = null;

    const ready = await initEngine();

    if (!ready) {
      setResult({ status: "locked" });
    } else {
      setResult({ status: "loading" });
      try {
        const root = await analyzePosition(ex.fen, { multipv: 3 });
        const cands = [];

        for (const l of lines) {
          const after = await analyzePosition(replay(ex.fen, [l.moves[0]]).fen, { multipv: 3 });
          cands.push({
            uci: l.moves[0].uci,
            san: l.moves[0].san,
            after,
            expectedReplyUci: l.moves[1]?.uci,
          });
        }

        metrics = scoreAttempt({ root, cands, turn: ex.turn, userEval: assessment });
        setResult({ status: "done", root, metrics, engine: getEngineName() });
      } catch (err) {
        console.error("[StudyLab] engine comparison failed:", err);
        setResult({ status: "error" });
      }
    }

    try {
      await saveAttempt({ ...base, metrics });
      await clearDraft(ex.id);
      onSaved?.();
    } catch (err) {
      console.error("[StudyLab] could not save attempt:", err);
    }
  }

  const canNext0 = assessment && factor;
  const canNext1 = lines.length >= 2;
  const canNext2 = lines.length > 0 && lines.every((l) => l.moves.length >= 3) && plan;

  return (
    <div className="qs-run">
      <div className="qs-run-top">
        <div>
          <div className="qo-eyebrow">{ex.difficulty} · {ex.type.replace(/_/g, " ")}</div>
          <h3>{ex.title}</h3>
          <p>{ex.intro}</p>
        </div>
        <div className="qs-run-actions">
          {stage < 3 && (
            <button className="qo-btn" onClick={onRestart}>
              Start over
            </button>
          )}
          <button className="qo-btn" onClick={onExit}>
            ← All exercises
          </button>
        </div>
      </div>

      {draft && stage < 3 && <p className="qo-note qs-banner">Resumed from where you stopped.</p>}

      <ol className="qs-steps">
        {STAGES.map((label, i) => (
          <li key={label} className={i === stage ? "is-active" : i < stage ? "is-done" : ""}>
            <span>{i + 1}</span> {label}
          </li>
        ))}
      </ol>

      <div className="qs-layout">
        <div className="qs-board">
          <PlayBoard
            fen={view.fen}
            flipped={flipped}
            lastMove={view.last}
            locked={stage === 0 || stage === 3 || (stage === 1 && (!!pending || lines.length >= 3))}
            onMove={stage === 1 ? onMoveStage1 : onMoveStage2}
          />
          <div className="qs-board-note">
            {stage === 1 && "Click a piece, then a square, to try a candidate move."}
            {stage === 2 && "Play both sides: the opponent's best reply, then your follow-up."}
          </div>
        </div>

        <div className="qs-panel">
          {/* ------------ Stage 0 ------------ */}
          {stage === 0 && (
            <>
              <section className="qs-card">
                <div className="qo-eyebrow">Position overview</div>
                <ul className="qs-facts">
                  <li><b>To move:</b> {ex.turn === "w" ? "White" : "Black"}</li>
                  <li><b>Material:</b> {materialText(ex.fen)}</li>
                </ul>
                <p className="qo-note">
                  Look at the position first. The engine stays hidden until you finish.
                </p>
              </section>

              <section className="qs-card">
                <div className="qo-eyebrow">1. Who is better?</div>
                <div className="qs-choices">
                  {EVAL_LEVELS.map((level) => (
                    <button
                      key={level.id}
                      className={`qs-choice ${assessment === level.id ? "is-on" : ""}`}
                      onClick={() => setAssessment(level.id)}
                    >
                      {level.label}
                    </button>
                  ))}
                </div>

                <div className="qo-eyebrow qs-gap">2. Most important factor</div>
                <div className="qs-choices qs-choices--wrap">
                  {FACTORS.map((item) => (
                    <button
                      key={item.id}
                      className={`qs-choice ${factor === item.id ? "is-on" : ""}`}
                      onClick={() => setFactor(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="qo-eyebrow qs-gap">3. What does the opponent want to do? (optional)</div>
                <textarea
                  className="qs-text"
                  rows={2}
                  value={threat}
                  onChange={(e) => setThreat(e.target.value)}
                  placeholder="e.g. attack the f3 knight, castle, open the e-file…"
                />
              </section>

              <button className="qo-btn qo-btn--primary" disabled={!canNext0} onClick={() => setStage(1)}>
                Lock my evaluation →
              </button>
            </>
          )}

          {/* ------------ Stage 1 ------------ */}
          {stage === 1 && (
            <>
              <section className="qs-card">
                <div className="qo-eyebrow">Choose 2–3 candidate moves</div>
                <p className="qo-note">
                  Play a move on the board, then save it as a candidate. You need at least two.
                </p>

                {pending && (
                  <div className="qs-pending">
                    <span>Trying <b>{pending.san}</b></span>
                    <div>
                      <button className="qo-btn qo-btn--primary" onClick={savePending}>Save as candidate</button>
                      <button className="qo-btn" onClick={() => setPending(null)}>Undo</button>
                    </div>
                  </div>
                )}

                <ul className="qs-cands">
                  {lines.map((l, i) => (
                    <li key={l.moves[0].uci}>
                      <span><b>{String.fromCharCode(65 + i)}</b> {l.moves[0].san}</span>
                      <button className="qs-link" onClick={() => removeLine(i)}>Remove</button>
                    </li>
                  ))}
                  {lines.length === 0 && !pending && <li className="qo-meta">No candidates yet.</li>}
                </ul>
              </section>

              <button className="qo-btn qo-btn--primary" disabled={!canNext1 || !!pending} onClick={() => { setActive(0); setStage(2); }}>
                Calculate these lines →
              </button>
            </>
          )}

          {/* ------------ Stage 2 ------------ */}
          {stage === 2 && (
            <>
              <section className="qs-card">
                <div className="qo-eyebrow">Calculate each line (at least 3 plies)</div>
                <div className="qs-tabs">
                  {lines.map((l, i) => (
                    <button
                      key={l.moves[0].uci}
                      className={`qs-tab ${i === active ? "is-on" : ""}`}
                      onClick={() => setActive(i)}
                    >
                      Line {String.fromCharCode(65 + i)}: {l.moves[0].san}
                    </button>
                  ))}
                </div>

                <div className="qs-linebox">
                  {lines[active] && formatLine(ex.fen, lines[active].moves)}
                </div>
                <div className="qs-linemeta">
                  <span>
                    {lines[active]?.moves.length || 0} plies
                    {lines[active] && lines[active].moves.length < 3 ? " · add your opponent's reply and a follow-up" : ""}
                  </span>
                  <button className="qs-link" onClick={undoStage2} disabled={!lines[active] || lines[active].moves.length <= 1}>
                    Undo last move
                  </button>
                </div>
              </section>

              <section className="qs-card">
                <div className="qo-eyebrow">Which plan do your lines serve?</div>
                <div className="qs-choices qs-choices--wrap">
                  {PLANS.map((item) => (
                    <button
                      key={item.id}
                      className={`qs-choice ${plan === item.id ? "is-on" : ""}`}
                      onClick={() => setPlan(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </section>

              <button className="qo-btn qo-btn--primary" disabled={!canNext2} onClick={submit}>
                Submit and compare →
              </button>
            </>
          )}

          {/* ------------ Stage 3 ------------ */}
          {stage === 3 && <ResultView ex={ex} lines={lines} assessment={assessment} factor={factor} plan={plan} result={result} onExit={onExit} />}
        </div>
      </div>
    </div>
  );
}

function ResultView({ ex, lines, assessment, factor, plan, result, onExit }) {
  const levelLabel = EVAL_LEVELS.find((l) => l.id === assessment)?.label;
  const factorLabel = FACTORS.find((f) => f.id === factor)?.label;
  const planLabel = PLANS.find((p) => p.id === plan)?.label;
  const suggested = ex.suggestedPlans.map((id) => PLANS.find((p) => p.id === id)?.label).filter(Boolean);

  return (
    <>
      <section className="qs-card">
        <div className="qo-eyebrow">Your thinking</div>
        <ul className="qs-facts">
          <li><b>Evaluation:</b> {levelLabel}</li>
          <li><b>Key factor:</b> {factorLabel}</li>
          <li><b>Plan:</b> {planLabel}</li>
        </ul>
        <ul className="qs-cands">
          {lines.map((l, i) => (
            <li key={l.moves[0].uci}>
              <span><b>{String.fromCharCode(65 + i)}</b> {formatLine(ex.fen, l.moves)}</span>
            </li>
          ))}
        </ul>
      </section>

      {result.status === "loading" && (
        <section className="qs-card"><p className="qo-note">Engine is analysing your lines…</p></section>
      )}

      {result.status === "locked" && (
        <section className="qs-card qs-locked">
          <div className="qo-eyebrow">Engine comparison</div>
          <p className="qo-note">
            The engine is not connected to the Study Lab yet, so evaluation and candidate scores are not available.
            Your attempt has been saved and will be scored once the engine is connected.
          </p>
        </section>
      )}

      {result.status === "error" && (
        <section className="qs-card qs-locked">
          <div className="qo-eyebrow">Engine comparison</div>
          <p className="qo-note">The engine could not analyse this position. Your attempt has been saved.</p>
        </section>
      )}

      {result.status === "done" && <EngineResults ex={ex} root={result.root} metrics={result.metrics} engine={result.engine} />}

      <section className="qs-card">
        <div className="qo-eyebrow">Curator's note</div>
        <p className="qo-note">{ex.curatorNote}</p>
        <p className="qo-note"><b>Suggested plans:</b> {suggested.join(", ")}.</p>
        <ul className="qs-themes">
          {ex.themes.map((t) => <li key={t}>{t}</li>)}
        </ul>
      </section>

      <button className="qo-btn qo-btn--primary" onClick={onExit}>Back to exercises</button>
    </>
  );
}

function EngineResults({ ex, root, metrics, engine }) {
  const verdictText = { reasonable: "Reasonable", inaccurate: "Playable but inaccurate", mistake: "Tactical or positional mistake" };
  const stat = (v) => (v === null || v === undefined ? "–" : `${v}`);

  return (
    <>
      <section className="qs-card">
        <div className="qo-eyebrow">Engine's best moves here</div>
        <ul className="qs-cands">
          {root.lines.slice(0, 3).map((line, i) => (
            <li key={i}>
              <span><b>{uciToSan(ex.fen, line.pv[0])}</b></span>
              <span className="qo-meta">{fmtCp(lineToCp(line))}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="qs-card">
        <div className="qo-eyebrow">Your candidates</div>
        <ul className="qs-results">
          {metrics.candidates.map((c) => (
            <li key={c.uci} className={`is-${c.verdict || "none"}`}>
              <div>
                <b>{c.san}</b>
                <span className="qs-badge">{c.verdict ? verdictText[c.verdict] : "Not judged"}</span>
              </div>
              <div className="qo-meta">
                {c.inEngineTop3 ? "In the engine's top 3. " : "Not in the engine's top 3. "}
                Eval for you after this move: {fmtCp(c.candCp)}.
                {c.replyInTop3 !== null && (c.replyInTop3 ? " Your expected reply was realistic." : " Your expected reply was not among the opponent's best.")}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="qs-card">
        <div className="qo-eyebrow">Skill checks (separate, not one score)</div>
        <div className="qs-stats">
          <div><strong>{stat(metrics.evalScore)}</strong><span>Evaluation understanding</span></div>
          <div><strong>{stat(metrics.candidateQuality)}</strong><span>Candidate quality</span></div>
          <div><strong>{stat(metrics.opponentRealism)}</strong><span>Opponent replies realistic</span></div>
        </div>
        {engine && engine !== "Stockfish" && (
          <p className="qo-note">
            Analysed by the {engine.toLowerCase()}, which is much weaker than Stockfish. Treat this as a rough guide.
          </p>
        )}
        <p className="qo-note">
          One exercise is too little evidence to judge a skill. Tactical awareness and plan understanding are not scored yet.
        </p>
      </section>
    </>
  );
}

/* ---------- Exercise list ---------- */

class Guard extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err) {
    console.error("[StudyLab] crashed:", err);
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="qo-empty">
          <h3>Study Lab could not load</h3>
          <p>The rest of your Openings page is not affected.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

function LabInner() {
  const [current, setCurrent] = useState(null); // { ex, draft, nonce }
  const [attempts, setAttempts] = useState([]);
  const [engine, setEngine] = useState("checking");
  const [engineName, setEngineName] = useState("");

  const refresh = () => loadAttempts().then(setAttempts);

  useEffect(() => {
    let alive = true;
    loadAttempts().then((list) => {
      if (alive) setAttempts(list);
    });
    initEngine().then((ok) => {
      if (!alive) return;
      setEngine(ok ? "ready" : "off");
      setEngineName(ok ? getEngineName() : "");
    });
    return () => {
      alive = false;
    };
  }, []);

  async function start(ex) {
    const draft = await loadDraft(ex.id).catch(() => null);
    setCurrent({ ex, draft, nonce: Date.now() });
  }

  async function restart(ex) {
    await clearDraft(ex.id).catch(() => {});
    setCurrent({ ex, draft: null, nonce: Date.now() });
  }

  if (current) {
    return (
      <Runner
        key={current.nonce}
        ex={current.ex}
        draft={current.draft}
        onExit={() => {
          setCurrent(null);
          refresh();
        }}
        onSaved={refresh}
        onRestart={() => restart(current.ex)}
      />
    );
  }

  return (
    <div className="qo-panel-content">
      <div className="qo-practice-head">
        <div>
          <span className="qo-mini-tag">Middlegame Lab</span>
          <h3>Think before you move</h3>
          <p>
            Evaluate the position, choose candidate moves, calculate your lines and only then compare
            with the engine. Positions come from the Italian Game lines you explored.
          </p>
        </div>
      </div>

      {engine === "off" && (
        <p className="qo-note qs-banner">
          No engine could be started, so the comparison is locked. You can still play the exercises and your attempts are saved.
        </p>
      )}
      {engine === "ready" && engineName !== "Stockfish" && (
        <p className="qo-note qs-banner">
          Using the {engineName.toLowerCase()} (much weaker than Stockfish). Connect Stockfish for stronger analysis. See README.txt.
        </p>
      )}

      <div className="qo-opening-grid">
        {BUILT.exercises.map((ex) => {
          const done = attempts.filter((a) => a.exerciseId === ex.id && a.status === "completed").length;
          return (
            <article className="qo-opening-card" key={ex.id}>
              <div className="qo-opening-card-top">
                <span className="qo-mini-tag">{ex.difficulty}</span>
                {done > 0 && <span className="qo-meta">Done ×{done}</span>}
              </div>
              <h3>{ex.title}</h3>
              <p>{ex.intro}</p>
              <div className="qo-opening-card-bottom">
                <span>{ex.type.replace(/_/g, " ")}</span>
                <button onClick={() => start(ex)}>Start →</button>
              </div>
            </article>
          );
        })}
      </div>

      {BUILT.exercises.length === 0 && (
        <div className="qo-empty">No valid exercises found. Run verifyStudy.mjs to see why.</div>
      )}
    </div>
  );
}

export default function StudyLab() {
  if (!BUILT) {
    return <div className="qo-empty"><h3>Study Lab data could not be built</h3></div>;
  }
  return (
    <Guard>
      <LabInner />
    </Guard>
  );
}
