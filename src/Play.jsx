import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import Board from "./Board";
import { createBot, LEVELS, PERSONALITIES } from "./Bot.js";
import { CALM_SECONDS, MIN_MOVES, MISSIONS, TIME_CHOICES, cleanOutcome, hangingPieces, hms, missionFor, missionOutcome, mmss, pickEndgame, pieceName, wasFreeCapture } from "./Playdata.js";
import { createEngine } from "./engine";
import { gradeAll, parseGame } from "./chessUtils";
import { analyseGame as buildRecord, computeLeaks, inWindow, loadReviewedGames } from "./leaks";
import { makeGameRecord, saveReviewedGame } from "./library";
import { buildCandidates, seedTraining } from "./lab";
import { betterLabel, explainMoment } from "./story";
import { dbAll, getSetting, setSetting } from "./storage";
import { setStepDone } from "./todayData";
import "./Play.css";

function go(page) {
  window.dispatchEvent(new CustomEvent("qelvaris-navigate", { detail: page }));
}

const FRESH = { freeLost: 0, pausesUsed: 0, clockAt25: null, userMoves: 0 };

function Bar({ name, sub, letter, clock, active, thinking, tone }) {
  return (
    <div className="pl-bar">
      <span className={`pl-avatar pl-avatar--${tone}`}>{letter}</span>
      <div className="pl-bar-text">
        <strong>{name}</strong>
        <span>{thinking ? "Thinking…" : sub}</span>
      </div>
      <span className={`pl-clock ${active ? "is-active" : ""} ${clock <= 30 ? "is-low" : ""}`}>{mmss(clock)}</span>
    </div>
  );
}

export default function Play() {
  /* ---------- Choices ---------- */
  const [missionId, setMissionId] = useState("safe-hands"); // ya "open"
  const [personality, setPersonality] = useState("solid");
  const [level, setLevel] = useState(4);
  const [minutes, setMinutes] = useState(10);
  const [recommended, setRecommended] = useState(null);

  /* ---------- Game ---------- */
  const [phase, setPhase] = useState("setup"); // setup | playing | over
  const [fen, setFen] = useState(() => new Chess().fen());
  const [lastMove, setLastMove] = useState(null);
  const [turn, setTurn] = useState("w");
  const [userColor, setUserColor] = useState("w");
  const [clocks, setClocks] = useState({ w: 600, b: 600 });
  const [stats, setStats] = useState(FRESH);
  const [selected, setSelected] = useState(null);
  const [pauseView, setPauseView] = useState(null);
  const [thinking, setThinking] = useState(false);
  const [startNote, setStartNote] = useState("");
  const [botError, setBotError] = useState("");
  const [outcome, setOutcome] = useState(null);
  const [review, setReview] = useState({ state: "idle" });
  const [starting, setStarting] = useState(false);

  const chessRef = useRef(null);
  const botRef = useRef(null);
  const engineRef = useRef(null);
  const timerRef = useRef(null);
  const lastTickRef = useRef(0);
  const clocksRef = useRef({ w: 600, b: 600 });
  const statsRef = useRef(FRESH);
  const endedRef = useRef(true);
  const cfgRef = useRef(null);

  const mission = missionId === "open" ? null : MISSIONS.find((m) => m.id === missionId);
  const personalityInfo = PERSONALITIES.find((p) => p.id === personality);

  /* ---------- Setup: saved choices aur sabse badi leak ---------- */
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const prefs = await getSetting("playPrefs", null);
        const records = await loadReviewedGames();
        if (!alive) return;

        if (prefs) {
          if (PERSONALITIES.some((p) => p.id === prefs.personality)) setPersonality(prefs.personality);
          if (prefs.level >= 1 && prefs.level <= 8) setLevel(prefs.level);
          if (TIME_CHOICES.includes(prefs.minutes)) setMinutes(prefs.minutes);
          if (prefs.mission) setMissionId(prefs.mission);
        }

        if (records.length) {
          const report = computeLeaks(inWindow(records, 30), records);
          const top = report.leaks[0];
          const rec = missionFor(top ? top.id : null);
          setRecommended({ id: rec.id, leak: top ? top.title : null, points: top ? top.points : null });
          setMissionId(rec.id);
        }
      } catch (error) {
        console.error("Play setup failed:", error);
      }
    })();

    return () => {
      alive = false;
      clearInterval(timerRef.current);
      endedRef.current = true;
      if (botRef.current) botRef.current.stop();
      if (engineRef.current) engineRef.current.stop();
    };
  }, []);

  /* ---------- Helpers ---------- */

  function syncBoard(move) {
    const chess = chessRef.current;
    setFen(chess.fen());
    setTurn(chess.turn());
    if (move) setLastMove({ from: move.from, to: move.to });
  }

  function patchStats(patch) {
    statsRef.current = { ...statsRef.current, ...patch };
    setStats(statsRef.current);
  }

  function stampClock(color) {
    try {
      chessRef.current.setComment(`[%clk ${hms(clocksRef.current[color])}]`);
    } catch {
      // clock comment optional
    }
  }

  function gameEnd() {
    const chess = chessRef.current;
    if (chess.isCheckmate()) return { result: chess.turn() === "w" ? "0-1" : "1-0", reason: "checkmate" };
    if (chess.isStalemate()) return { result: "1/2-1/2", reason: "stalemate" };
    if (chess.isDraw()) return { result: "1/2-1/2", reason: "a draw" };
    return null;
  }

  /* ---------- Clock ---------- */

  function startClock() {
    clearInterval(timerRef.current);
    lastTickRef.current = performance.now();

    timerRef.current = setInterval(() => {
      if (endedRef.current) return;

      const now = performance.now();
      const dt = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;

      const side = chessRef.current.turn();
      clocksRef.current = { ...clocksRef.current, [side]: clocksRef.current[side] - dt };
      setClocks(clocksRef.current);

      if (clocksRef.current[side] <= 0) {
        clocksRef.current = { ...clocksRef.current, [side]: 0 };
        setClocks(clocksRef.current);
        const cfg = cfgRef.current;
        const userRanOut = side === cfg.userColor;
        finish(userRanOut === (cfg.userColor === "w") ? "0-1" : "1-0", "time");
      }
    }, 250);
  }

  /* ---------- Start ---------- */

  async function start() {
    if (starting) return;
    setStarting(true);
    setBotError("");

    try {
      const chosen = mission;
      let startFen = null;
      let color = "w";
      let note = "";

      if (chosen && chosen.id === "convert-win") {
        const endgame = await pickEndgame();
        startFen = endgame.fen;
        color = endgame.userColor;
        note = endgame.own ? "A winning endgame from one of your own games." : "A standard winning endgame.";
      }

      const chess = startFen ? new Chess(startFen) : new Chess();
      chessRef.current = chess;
      cfgRef.current = { mission: chosen, personality, level, minutes, userColor: color, startFen };

      botRef.current = createBot();
      statsRef.current = FRESH;
      clocksRef.current = { w: minutes * 60, b: minutes * 60 };
      endedRef.current = false;

      setStats(FRESH);
      setClocks(clocksRef.current);
      setUserColor(color);
      setSelected(null);
      setPauseView(null);
      setOutcome(null);
      setReview({ state: "idle" });
      setLastMove(null);
      setStartNote(note);
      syncBoard(null);
      setPhase("playing");

      setSetting("playPrefs", { mission: missionId, personality, level, minutes }).catch(() => {});

      startClock();
      if (chess.turn() !== color) botTurn();
    } catch (error) {
      console.error("Could not start:", error);
      setBotError("Could not start the game. Please try again.");
    } finally {
      setStarting(false);
    }
  }

  /* ---------- Bot ---------- */

  async function botTurn() {
    const chess = chessRef.current;
    const cfg = cfgRef.current;
    if (!chess || endedRef.current) return;

    setThinking(true);

    let uci = "";
    try {
      uci = await botRef.current.pick(chess.fen(), { level: cfg.level, personality: cfg.personality });
    } catch (error) {
      if (endedRef.current) return;
      console.error("Bot failed:", error);
    }

    if (endedRef.current) return;
    setThinking(false);

    const fenBefore = chess.fen();
    let move = null;

    if (uci) {
      try {
        move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      } catch {
        move = null;
      }
    }

    // Engine na chale toh bhi game rukti nahi: koi legal chaal
    if (!move) {
      const legal = chess.moves({ verbose: true });
      if (!legal.length) return;
      const pick = legal[Math.floor(Math.random() * legal.length)];
      move = chess.move({ from: pick.from, to: pick.to, promotion: pick.promotion });
      setBotError("The bot engine could not start, so it is playing random moves.");
    }

    const botColor = cfg.userColor === "w" ? "b" : "w";
    stampClock(botColor);

    if (move.captured && wasFreeCapture(fenBefore, move.from, move.to, move.promotion)) {
      patchStats({ freeLost: statsRef.current.freeLost + 1 });
    }

    syncBoard(move);
    setPauseView(null);

    const end = gameEnd();
    if (end) finish(end.result, end.reason);
  }

  /* ---------- Your move ---------- */

  const targets = useMemo(() => {
    if (!selected || phase !== "playing") return [];
    try {
      return new Chess(fen).moves({ square: selected, verbose: true }).map((m) => m.to);
    } catch {
      return [];
    }
  }, [selected, phase, fen]);

  function onSquare(square) {
    const chess = chessRef.current;
    if (!chess || phase !== "playing" || endedRef.current || thinking || chess.turn() !== userColor) return;

    if (selected && targets.includes(square)) {
      const legal = chess.moves({ square: selected, verbose: true }).filter((m) => m.to === square);
      const pick = legal.find((m) => !m.promotion || m.promotion === "q") || legal[0];
      if (!pick) return;

      const move = chess.move({ from: pick.from, to: pick.to, promotion: pick.promotion });
      stampClock(userColor);

      const count = statsRef.current.userMoves + 1;
      patchStats({
        userMoves: count,
        clockAt25: count === MIN_MOVES ? clocksRef.current[userColor] : statsRef.current.clockAt25,
      });

      setSelected(null);
      setPauseView(null);
      syncBoard(move);

      const end = gameEnd();
      if (end) finish(end.result, end.reason);
      else botTurn();
      return;
    }

    const piece = chess.get(square);
    if (piece && piece.color === chess.turn() && chess.moves({ square, verbose: true }).length) {
      setSelected(square);
      setPauseView(null);
    } else {
      setSelected(null);
    }
  }

  function safetyPause() {
    const chess = chessRef.current;
    const cfg = cfgRef.current;
    if (!chess || !cfg || !cfg.mission || cfg.mission.pauses - statsRef.current.pausesUsed <= 0) return;
    if (endedRef.current || thinking || chess.turn() !== userColor) return;

    patchStats({ pausesUsed: statsRef.current.pausesUsed + 1 });
    setSelected(null);

    const list = hangingPieces(chess.fen(), userColor);
    setPauseView({
      squares: list.map((item) => item.square),
      text: list.length
        ? `Can be taken for free: ${list.map((item) => `${pieceName(item.piece)} on ${item.square}`).join(", ")}.`
        : "Nothing of yours can be taken for free right now.",
    });
  }

  function resign() {
    if (endedRef.current) return;
    finish(userColor === "w" ? "0-1" : "1-0", "resignation");
  }

  /* ---------- End of game ---------- */

  async function finish(result, reason) {
    if (endedRef.current) return;
    endedRef.current = true;
    clearInterval(timerRef.current);
    if (botRef.current) botRef.current.stop();
    botRef.current = null;

    setThinking(false);
    setSelected(null);
    setPhase("over");

    const cfg = cfgRef.current;
    const s = statsRef.current;
    const done = missionOutcome(cfg.mission, {
      result,
      userColor: cfg.userColor,
      freeLost: s.freeLost,
      clockAt25: s.clockAt25,
      reason,
    });
    setOutcome({ ...done, result, reason });

    if (done.done && cfg.mission) setStepDone("mission", true).catch(() => {});

    await analyse(result, cfg, done);
  }

  async function analyse(result, cfg, done) {
    const chess = chessRef.current;

    try {
      const names = await getSetting("my-usernames", []);
      const me = Array.isArray(names) && names[0] ? names[0] : "You";
      const botName = `${PERSONALITIES.find((p) => p.id === cfg.personality).label} bot (level ${cfg.level})`;

      chess.setHeader("Event", cfg.mission ? `Mission · ${cfg.mission.title}` : "Open play");
      chess.setHeader("White", cfg.userColor === "w" ? me : botName);
      chess.setHeader("Black", cfg.userColor === "b" ? me : botName);
      chess.setHeader("Result", result);
      chess.setHeader("Date", new Date().toISOString().slice(0, 10).replace(/-/g, "."));
      if (cfg.startFen) {
        chess.setHeader("SetUp", "1");
        chess.setHeader("FEN", cfg.startFen);
      }

      if (!chess.history().length) {
        setReview({ state: "skipped" });
        return;
      }

      const parsed = parseGame(chess.pgn());
      const depth = Number(await getSetting("analysis-depth", null)) || Number(await getSetting("engineDepth", 8)) || 8;

      setReview({ state: "running", done: 0, total: parsed.fens.length });

      const engine = createEngine({ multiPv: 2 });
      engineRef.current = engine;
      const evals = await engine.analyseGame(parsed, {
        depth,
        onProgress: (d, total) => setReview({ state: "running", done: d, total }),
      });
      engine.stop();
      engineRef.current = null;

      const moves = gradeAll(parsed, evals);
      const id = `bot-${Date.now()}`;
      const game = makeGameRecord(parsed, { id, source: "bot", date: new Date().toISOString(), userColor: cfg.userColor });
      const saved = await saveReviewedGame({ game, parsed, moves, depth });
      const record = buildRecord(saved, parsed, moves);

      // Sabse mehengi galti = is game ka ek turning point
      const worst = record.userMoves
        .filter((m) => m.isError && (m.winLoss || 0) >= 6)
        .sort((a, b) => b.winLoss - a.winLoss)[0];

      const tp = worst
        ? {
            fen: worst.fenBefore,
            san: worst.san,
            cat: worst.cat,
            moveNumber: worst.moveNumber,
            better: worst.bestSan ? betterLabel(worst) : "",
            arrow: worst.best && worst.best !== worst.uci ? { from: worst.best.slice(0, 2), to: worst.best.slice(2, 4) } : null,
            text: explainMoment({ ...worst, kind: "mistake" }).en,
          }
        : null;

      // Galtiyan Leak Lab mein apne aap
      const before = (await dbAll("training")).length;
      const list = await seedTraining([record]);
      const added = Math.max(0, list.length - before);

      if (cfg.mission && cfg.mission.id === "clean-game") {
        const final = cleanOutcome(record.userMoves);
        setOutcome((prev) => ({ ...prev, ...final, pending: false }));
        if (final.done) setStepDone("mission", true).catch(() => {});
      }

      setReview({ state: "done", gameId: id, tp, added, candidates: buildCandidates([record]).length });
    } catch (error) {
      if (String(error?.message) === "stopped") return;
      console.error("Review after game failed:", error);
      setReview({ state: "error" });
    }
  }

  function reset() {
    clearInterval(timerRef.current);
    endedRef.current = true;
    if (engineRef.current) engineRef.current.stop();
    engineRef.current = null;

    chessRef.current = null;
    setPhase("setup");
    setFen(new Chess().fen());
    setLastMove(null);
    setTurn("w");
    setUserColor("w");
    setSelected(null);
    setPauseView(null);
    setOutcome(null);
    setReview({ state: "idle" });
    setBotError("");
    setStartNote("");
    setStats(FRESH);
    const base = minutes * 60;
    clocksRef.current = { w: base, b: base };
    setClocks(clocksRef.current);
  }

  function openInReview() {
    if (review.state !== "done") return;
    setSetting("selected-game", review.gameId)
      .catch(() => {})
      .finally(() => go("Review"));
  }

  /* ---------- Render ---------- */

  const playing = phase === "playing";
  const locked = phase !== "setup";
  const cfg = cfgRef.current;
  const activeMission = playing || phase === "over" ? cfg?.mission ?? null : mission;
  const botColor = userColor === "w" ? "b" : "w";
  const botLabel = PERSONALITIES.find((p) => p.id === (cfg?.personality || personality))?.label;
  const pausesLeft = activeMission ? activeMission.pauses - stats.pausesUsed : 0;
  const myTurn = playing && turn === userColor && !thinking;

  const shownClocks = phase === "setup" ? { w: minutes * 60, b: minutes * 60 } : clocks;
  const boardTargets = pauseView && !selected ? pauseView.squares : targets;

  return (
    <div className="pl-page">
      <div className="pl-grid">
        {/* Choose */}
        <section className="q-card pl-choose">
          <span className="pl-label">Choose a mission</span>

          <div className={`pl-missions ${locked ? "is-locked" : ""}`}>
            {MISSIONS.map((m) => (
              <button
                key={m.id}
                className={`pl-mission ${missionId === m.id ? "is-on" : ""}`}
                onClick={() => setMissionId(m.id)}
                disabled={locked}
                aria-pressed={missionId === m.id}
              >
                <div className="pl-mission-top">
                  <strong>{m.title}</strong>
                  {recommended && recommended.id === m.id && <span className="pl-rec">For your top leak</span>}
                </div>
                <span className="pl-goal">{m.goal}</span>
                <span className="pl-tag">{m.tag}</span>
              </button>
            ))}

            <button
              className={`pl-mission pl-mission--open ${missionId === "open" ? "is-on" : ""}`}
              onClick={() => setMissionId("open")}
              disabled={locked}
              aria-pressed={missionId === "open"}
            >
              <div className="pl-mission-top">
                <strong>Open play</strong>
              </div>
              <span className="pl-goal">An ordinary game. No goal, no safety pause.</span>
            </button>
          </div>

          <span className="pl-label">Bot personality</span>
          <div className="pl-chips" role="radiogroup" aria-label="Bot personality">
            {PERSONALITIES.map((p) => (
              <button
                key={p.id}
                role="radio"
                aria-checked={personality === p.id}
                className={`pl-chip ${personality === p.id ? "is-on" : ""}`}
                onClick={() => setPersonality(p.id)}
                disabled={locked}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="pl-hint">{personalityInfo.text}</p>

          <span className="pl-label">Strength</span>
          <div className="pl-levels" role="radiogroup" aria-label="Strength">
            {LEVELS.map((_, i) => (
              <button
                key={i}
                role="radio"
                aria-checked={level === i + 1}
                className={`pl-level ${level === i + 1 ? "is-on" : ""}`}
                onClick={() => setLevel(i + 1)}
                disabled={locked}
              >
                {i + 1}
              </button>
            ))}
          </div>

          <span className="pl-label">Time each</span>
          <div className="pl-chips" role="radiogroup" aria-label="Time each">
            {TIME_CHOICES.map((m) => (
              <button
                key={m}
                role="radio"
                aria-checked={minutes === m}
                className={`pl-chip ${minutes === m ? "is-on" : ""}`}
                onClick={() => setMinutes(m)}
                disabled={locked}
              >
                {m} min
              </button>
            ))}
          </div>

          {phase === "setup" && (
            <button className="pl-start" onClick={start} disabled={starting}>
              {mission ? "Start mission" : "Start game"}
            </button>
          )}
          {playing && (
            <button className="pl-start pl-start--resign" onClick={resign}>
              Resign
            </button>
          )}
          {phase === "over" && (
            <button className="pl-start" onClick={reset}>
              New game
            </button>
          )}
        </section>

        {/* Board */}
        <section className="q-card pl-boardcard">
          <Bar
            name={`Bot · ${botLabel}`}
            sub={`Level ${cfg?.level ?? level}`}
            letter="B"
            tone="bot"
            clock={shownClocks[botColor]}
            active={playing && turn === botColor}
            thinking={thinking}
          />

          <div className="pl-board">
            <Board
              fen={fen}
              flipped={userColor === "b"}
              lastMove={lastMove}
              selected={selected}
              targets={boardTargets}
              onSquareClick={myTurn ? onSquare : null}
            />
          </div>

          <Bar
            name="You"
            sub={userColor === "w" ? "White" : "Black"}
            letter="Y"
            tone="you"
            clock={shownClocks[userColor]}
            active={playing && turn === userColor}
          />

          {startNote && <p className="pl-note">{startNote}</p>}
          {botError && <p className="pl-note pl-note--warn" role="status">{botError}</p>}
        </section>

        {/* Mission panel */}
        <aside className="q-card pl-info">
          <div className="pl-info-head">
            <span className="pl-label">
              {activeMission ? `Mission · ${activeMission.title}` : "Open play"}
            </span>
            <span className={`pl-state pl-state--${phase}`}>
              {phase === "setup" ? "Ready" : phase === "playing" ? "In progress" : "Finished"}
            </span>
          </div>

          {phase !== "over" && (
            <>
              {activeMission ? <p className="pl-goal-big">{activeMission.goal}</p> : <p className="pl-goal-big">A normal game against the bot.</p>}

              {activeMission && activeMission.id === "safe-hands" && (
                <>
                  <div className="pl-rows">
                    <div className="pl-row">
                      <span>Free pieces lost</span>
                      <strong className={stats.freeLost > 0 ? "is-bad" : ""}>{stats.freeLost}</strong>
                    </div>
                    <div className="pl-row">
                      <span>Move</span>
                      <strong>{stats.userMoves} of {MIN_MOVES} minimum</strong>
                    </div>
                    <div className="pl-row">
                      <span>Safety pauses left</span>
                      <strong>{playing ? pausesLeft : activeMission.pauses}</strong>
                    </div>
                  </div>

                  <button className="pl-pause" onClick={safetyPause} disabled={!playing || pausesLeft <= 0 || !myTurn}>
                    Safety pause
                  </button>
                  {pauseView ? (
                    <p className={`pl-pause-msg ${pauseView.squares.length ? "is-warn" : "is-good"}`} role="status">
                      {pauseView.text}
                    </p>
                  ) : (
                    <p className="pl-hint">
                      Shows whether any of your pieces can be taken for free. Each use costs one pause, so it teaches checking rather than leaning on it.
                    </p>
                  )}
                </>
              )}

              {activeMission && activeMission.id === "clock-calm" && (
                <div className="pl-rows">
                  <div className="pl-row">
                    <span>Your clock</span>
                    <strong className={playing && clocks[userColor] < CALM_SECONDS ? "is-bad" : ""}>{mmss(shownClocks[userColor])}</strong>
                  </div>
                  <div className="pl-row">
                    <span>Move</span>
                    <strong>{stats.userMoves} of {MIN_MOVES}</strong>
                  </div>
                  <div className="pl-row">
                    <span>{stats.clockAt25 === null ? "Needed at move 25" : "Clock at move 25"}</span>
                    <strong className={stats.clockAt25 !== null && stats.clockAt25 < CALM_SECONDS ? "is-bad" : ""}>
                      {stats.clockAt25 === null ? "3:00 or more" : mmss(stats.clockAt25)}
                    </strong>
                  </div>
                </div>
              )}

              {activeMission && activeMission.id === "convert-win" && (
                <div className="pl-rows">
                  <div className="pl-row">
                    <span>Your side</span>
                    <strong>{playing || phase === "over" ? (userColor === "w" ? "White" : "Black") : "Set at start"}</strong>
                  </div>
                  <div className="pl-row">
                    <span>Move</span>
                    <strong>{stats.userMoves}</strong>
                  </div>
                  <div className="pl-row">
                    <span>Needed</span>
                    <strong>A win</strong>
                  </div>
                </div>
              )}

              {activeMission && activeMission.id === "clean-game" && (
                <div className="pl-rows">
                  <div className="pl-row">
                    <span>Move</span>
                    <strong>{stats.userMoves}</strong>
                  </div>
                  <div className="pl-row">
                    <span>Checked after the game</span>
                    <strong>No mistakes or blunders</strong>
                  </div>
                </div>
              )}

              <span className="pl-label pl-label--gap">When the game ends</span>
              <p className="pl-hint pl-hint--flush">
                You get a mission result, one turning point, and any mistake is added to Leak Lab automatically.
              </p>
              <p className="pl-fine">Safety pause is off in open play, so ordinary games still feel like real games.</p>
            </>
          )}

          {phase === "over" && outcome && (
            <div className="pl-result">
              <h2 className={`pl-result-title ${outcome.done ? "is-good" : outcome.pending ? "" : "is-bad"}`}>{outcome.title}</h2>
              <p className="pl-result-text">{outcome.text}</p>

              <div className="pl-rows">
                <div className="pl-row">
                  <span>Result</span>
                  <strong>
                    {outcome.result === "1/2-1/2" ? "Draw" : (outcome.result === "1-0") === (userColor === "w") ? "You won" : "You lost"} · {outcome.reason}
                  </strong>
                </div>
                {activeMission && activeMission.id === "safe-hands" && (
                  <div className="pl-row">
                    <span>Free pieces lost</span>
                    <strong className={stats.freeLost > 0 ? "is-bad" : ""}>{stats.freeLost}</strong>
                  </div>
                )}
              </div>

              {review.state === "running" && (
                <div className="pl-progress" role="status">
                  <span>Checking your game · {review.done} of {review.total}</span>
                  <div className="pl-progress-bar">
                    <div style={{ width: `${review.total ? (review.done / review.total) * 100 : 0}%` }} />
                  </div>
                </div>
              )}

              {review.state === "skipped" && <p className="pl-hint">The game was too short to review.</p>}
              {review.state === "error" && (
                <p className="pl-pause-msg is-warn">The engine could not review this game. It was not saved.</p>
              )}

              {review.state === "done" && (
                <>
                  <span className="pl-label pl-label--gap">One turning point</span>
                  {review.tp ? (
                    <div className="pl-tp">
                      <div className="pl-tp-board">
                        <Board fen={review.tp.fen} flipped={userColor === "b"} arrow={review.tp.arrow} showCoords={false} />
                      </div>
                      <div>
                        <strong>
                          Move {review.tp.moveNumber} · You played {review.tp.san}
                        </strong>
                        {review.tp.better && <span className="pl-better">Better: {review.tp.better}</span>}
                        <p>{review.tp.text}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="pl-hint pl-hint--flush">No big mistake in this game. Nothing to fix here.</p>
                  )}

                  <p className="pl-added">
                    {review.added > 0
                      ? `${review.added} ${review.added === 1 ? "position was" : "positions were"} added to Leak Lab.`
                      : "Nothing new for Leak Lab from this game."}
                  </p>

                  <div className="pl-actions">
                    <button className="pl-btn pl-btn--primary" onClick={openInReview}>
                      Open in Review
                    </button>
                    <button className="pl-btn" onClick={() => go("Leak Lab")}>
                      Leak Lab
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
