import { useEffect, useMemo, useRef, useState } from "react";
import PlayBoard from "../study/PlayBoard";
import { saveLessonResult } from "./lessonStorage";
import "./Middlegames.css";

// Coach lesson: position beech se shuru, user pehle chaal predict karta hai, phir reason milta hai.
// Opponent ki chaal apne aap aati hai (reason ke saath). Aakhir mein takeaways + "Play this position".

export default function MiddlegameLesson({ lesson, onExit, onPlay, onDone }) {
  const [phase, setPhase] = useState("intro"); // intro | run | done
  const [mode, setMode] = useState("predict"); // predict | watch
  const [idx, setIdx] = useState(0); // kitni chaalein khul chuki hain
  const [misses, setMisses] = useState(0);
  const [wrongNote, setWrongNote] = useState("");
  const [results, setResults] = useState([]); // user-side steps: "first" | "later" | "shown" | "watched"
  const [peek, setPeek] = useState(null); // purani chaal dekhne ke liye
  const savedRef = useRef(false);

  const steps = lesson.steps;
  const next = steps[idx] || null;
  const live = phase === "run" && peek === null;
  const userTurn = live && Boolean(next) && next.by === "user" && mode === "predict";
  const userSteps = steps.filter((s) => s.by === "user").length;

  const shownIdx = peek !== null ? peek + 1 : idx; // board par kitni chaalein
  const fen = shownIdx === 0 ? lesson.startFen : steps[shownIdx - 1].fenAfter;
  const lastStep = shownIdx > 0 ? steps[shownIdx - 1] : null;
  const lastMove = lastStep ? { from: lastStep.from, to: lastStep.to } : null;
  const flipped = lesson.side === "black";
  const sideName = lesson.side === "white" ? "White" : "Black";

  function reveal(kind) {
    if (!next) return;
    setResults((prev) => (next.by === "user" ? [...prev, kind] : prev));
    setIdx((n) => n + 1);
    setMisses(0);
    setWrongNote("");
  }

  // Opponent ki chaal predict mode mein apne aap
  useEffect(() => {
    if (!(live && mode === "predict" && next && next.by === "opp")) return undefined;
    const t = setTimeout(() => reveal("opp"), 750);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, mode, idx]);

  // Lesson khatam
  useEffect(() => {
    if (phase !== "run" || idx < steps.length) return;
    setPhase("done");
  }, [phase, idx, steps.length]);

  const firstTry = results.filter((r) => r === "first").length;

  useEffect(() => {
    if (phase !== "done" || savedRef.current) return;
    savedRef.current = true;
    saveLessonResult(lesson.id, { firstTry: mode === "predict" ? firstTry : null, total: userSteps })
      .then((progress) => onDone?.(progress))
      .catch((err) => console.error("Could not save lesson result:", err));
  }, [phase, lesson.id, mode, firstTry, userSteps, onDone]);

  function start(nextMode) {
    setMode(nextMode);
    setPhase("run");
    setIdx(0);
    setResults([]);
    setPeek(null);
    setMisses(0);
    setWrongNote("");
    savedRef.current = false;
  }

  function onUserMove(m) {
    if (!userTurn || !next) return;
    if (m.uci === next.uci) {
      reveal(misses === 0 ? "first" : "later");
    } else {
      setMisses((n) => n + 1);
      setWrongNote(`${m.san} is not the move this lesson follows. It can still be playable, so think again about the plan. You can try again or show the answer.`);
    }
  }

  const log = useMemo(() => steps.slice(0, idx), [steps, idx]);
  const current = peek !== null ? steps[peek] : idx > 0 ? steps[idx - 1] : null;

  return (
    <div className="qm">
      <div className="qm-top">
        <div>
          <div className="qo-eyebrow">{lesson.opening} · {lesson.plan} · {lesson.level}</div>
          <h3>{lesson.title}</h3>
          <p className="qo-note">You learn as {sideName}. {lesson.learn}</p>
        </div>
        <button className="qo-btn" onClick={onExit}>← All lessons</button>
      </div>

      <div className="qm-layout">
        <div className="qm-board">
          <PlayBoard fen={fen} flipped={flipped} lastMove={lastMove} locked={!userTurn} onMove={onUserMove} />
          {phase === "run" && (
            <div className="qm-progress" aria-label="Lesson progress">
              {steps.map((s, i) => (
                <span key={`${s.label}-${i}`} className={`qm-dot ${i < idx ? "is-done" : ""} ${i === idx ? "is-now" : ""}`} />
              ))}
            </div>
          )}
        </div>

        <div className="qm-panel">
          {phase === "intro" && (
            <section className="qm-card">
              <div className="qo-eyebrow">Where we are</div>
              <p>{lesson.situation}</p>
              <p className="qo-note">
                About {steps.length} moves. {userSteps} of them are yours: guess each one, and the coach explains why it works.
              </p>
              <div className="qm-actions">
                <button className="qo-btn qo-btn--primary" onClick={() => start("predict")}>Start: guess the moves</button>
                <button className="qo-btn" onClick={() => start("watch")}>Just watch</button>
              </div>
            </section>
          )}

          {phase === "run" && (
            <section className="qm-card qm-coach">
              <div className="qo-eyebrow">
                Coach · move {Math.min(idx + 1, steps.length)} of {steps.length}
              </div>

              {peek === null && userTurn && (
                <>
                  <h4>Your move as {sideName}. What would you play?</h4>
                  <p className="qo-note">Think about which piece or plan the position needs. Click a piece, then a square.</p>
                  {wrongNote && <p className="qm-wrong">{wrongNote}</p>}
                  <div className="qm-actions">
                    <button className="qo-btn" onClick={() => reveal("shown")}>Show the answer</button>
                  </div>
                </>
              )}

              {peek === null && live && mode === "predict" && next && next.by === "opp" && !userTurn && (
                <p className="qo-note">The opponent replies…</p>
              )}

              {peek === null && live && mode === "watch" && next && (
                <>
                  <p className="qo-note">{next.by === "user" ? `Next: ${sideName}'s move.` : "Next: the opponent's reply."}</p>
                  <div className="qm-actions">
                    <button className="qo-btn qo-btn--primary" onClick={() => reveal("watched")}>Next move →</button>
                  </div>
                </>
              )}

              {current && (
                <div className={`qm-reason ${current.by === "user" ? "is-user" : "is-opp"}`}>
                  <div className="qm-reason-head">
                    <b>{current.label}</b>
                    <span>{current.by === "user" ? "Coach move" : "Opponent's reply"}</span>
                  </div>
                  <p>{current.why}</p>
                </div>
              )}

              {peek !== null && (
                <div className="qm-actions">
                  <button className="qo-btn" onClick={() => setPeek(null)}>Back to the current position</button>
                </div>
              )}
            </section>
          )}

          {phase === "done" && (
            <section className="qm-card qm-done">
              <div className="qo-eyebrow">Lesson complete</div>
              {mode === "predict" ? (
                <h4>You found {firstTry} of {userSteps} coach moves on the first try.</h4>
              ) : (
                <h4>You watched the whole lesson.</h4>
              )}
              <div className="qm-take">
                <b>What to take away</b>
                <ul>
                  {lesson.takeaways.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
              <div className="qm-actions">
                <button className="qo-btn qo-btn--primary" onClick={() => onPlay?.(lesson)}>Play this position →</button>
                <button className="qo-btn" onClick={() => start(mode)}>Do it again</button>
                <button className="qo-btn" onClick={onExit}>More lessons</button>
              </div>
            </section>
          )}

          {log.length > 0 && (
            <section className="qm-card">
              <div className="qo-eyebrow">Moves so far</div>
              <div className="qm-log">
                {log.map((s, i) => (
                  <button
                    key={`${s.label}-${i}`}
                    className={`qm-chip ${s.by === "user" ? "is-user" : "is-opp"} ${peek === i ? "is-current" : ""}`}
                    onClick={() => setPeek(i === idx - 1 && phase === "run" ? null : i)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
