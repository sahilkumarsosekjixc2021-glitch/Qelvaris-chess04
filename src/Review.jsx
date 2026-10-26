import { useCallback, useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import Board from "./Board";
import { dbAll, dbGet, dbPut, getSetting, setSetting } from "./storage";
import { CATEGORIES, CATEGORY_ORDER, parseGame, summarize, winChance } from "./chessUtils";
import { analyseGame as buildRecord } from "./leaks";
import { betterLabel, explainMoment, moveLabel, pickTurningPoints } from "./story";
import "./Review.css";

function goTo(page) {
  window.dispatchEvent(new CustomEvent("qelvaris-navigate", { detail: page }));
}

async function loadGameData(game) {
  const parsed = parseGame(game.pgn);
  const review = await dbGet("reviews", game.id);

  if (!review || !Array.isArray(review.moves) || review.moves.length !== parsed.moves.length) {
    throw new Error("This game has no saved review yet.");
  }

  const moves = review.moves;
  return { game, parsed, moves, record: buildRecord(game, parsed, moves), summary: summarize(moves) };
}

function guessFeedback(tp, guess, lang) {
  if (!guess) return "";

  if (guess.uci === tp.best) {
    return lang === "hi"
      ? "Bilkul sahi. Yahi engine ki sabse achhi chaal hai."
      : "Yes, that is the engine's top move.";
  }

  if (guess.uci === tp.uci) {
    return lang === "hi"
      ? `${guess.san} wahi chaal hai jo aapne game mein chali thi.`
      : `${guess.san} is the move you played in the game.`;
  }

  return lang === "hi"
    ? `Aapne ${guess.san} chuni. Engine ko ${tp.bestSan} zyada pasand tha.`
    : `You chose ${guess.san}. The engine preferred ${tp.bestSan}.`;
}

/* Game ki kahani: aapke jeetne ke chance ka graph, aur uspar 1, 2, 3 turning points */
function StoryBar({ moves, userColor, tps, cursor, tpIndex, onSelectTp, onSeek }) {
  const n = moves.length;
  const points = [];

  for (let i = 0; i <= n; i += 1) {
    const value = i === 0 ? moves[0]?.evalBefore : moves[i - 1]?.evalAfter;
    if (typeof value !== "number") {
      points.push(null);
      continue;
    }
    const white = winChance(value);
    const mine = userColor === "w" ? white : 100 - white;
    points.push({ x: n ? (i / n) * 600 : 0, y: 100 - mine });
  }

  const known = points.filter(Boolean);
  const line = known.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  function handleClick(event) {
    if (!n) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    onSeek(Math.max(0, Math.min(n, Math.round(ratio * n))));
  }

  return (
    <div className="st-story" onClick={handleClick}>
      <svg viewBox="0 0 600 100" preserveAspectRatio="none">
        <line x1="0" y1="50" x2="600" y2="50" className="st-story-mid" vectorEffect="non-scaling-stroke" />
        {line && <polyline points={line} className="st-story-line" vectorEffect="non-scaling-stroke" />}
      </svg>

      <span className="st-story-cursor" style={{ left: `${n ? (cursor / n) * 100 : 0}%` }} />

      {tps.map((tp, i) => {
        const p = points[tp.ply];
        return (
          <button
            key={tp.ply}
            className={`st-marker ${tp.kind === "mistake" ? "is-bad" : "is-good"} ${tpIndex === i ? "is-on" : ""}`}
            style={{ left: `${n ? (tp.ply / n) * 100 : 0}%`, top: `${p ? Math.min(82, Math.max(18, p.y)) : 50}%` }}
            onClick={(event) => {
              event.stopPropagation();
              onSelectTp(i);
            }}
            aria-label={`Turning point ${i + 1}`}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}

export default function Review() {
  const [games, setGames] = useState(null);
  const [gameId, setGameId] = useState(null);
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");

  const [cursor, setCursor] = useState(0);
  const [tpIndex, setTpIndex] = useState(null);
  const [guessMode, setGuessMode] = useState(true);
  const [guess, setGuess] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [selected, setSelected] = useState(null);
  const [lang, setLang] = useState("en");
  const [showAll, setShowAll] = useState(false);
  const [flipExtra, setFlipExtra] = useState(false);
  const [addedIds, setAddedIds] = useState({});

  /* Reviewed games ki list aur language */
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const all = (await dbAll("games"))
          .filter((g) => g.analysisComplete && g.pgn)
          .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

        const savedLang = await getSetting("language", "en");
        const picked = await getSetting("selected-game", null);
        const wanted = picked || (await getSetting("reviewGameId", null));
        if (!alive) return;

        setGames(all);
        setLang(savedLang === "hi" ? "hi" : "en");

        const first = all.find((g) => g.id === wanted) || all[0];
        if (first) setGameId(first.id);
        if (picked) setSetting("selected-game", null).catch(() => {});
      } catch (error) {
        console.error("Could not load games:", error);
        if (alive) setGames([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  /* Chuni hui game load karo */
  useEffect(() => {
    if (!gameId || !games) return undefined;
    const game = games.find((g) => g.id === gameId);
    if (!game) return undefined;

    let alive = true;
    setLoadError("");

    loadGameData(game)
      .then((loaded) => {
        if (!alive) return;

        const points = pickTurningPoints(loaded.record.userMoves);

        setData(loaded);
        setShowAll(false);
        setFlipExtra(false);
        setGuess(null);
        setRevealed(false);
        setSelected(null);

        if (points.length) {
          setTpIndex(0);
          setCursor(points[0].ply - 1);
        } else {
          setTpIndex(null);
          setCursor(0);
        }
      })
      .catch((error) => {
        console.error("Could not open game:", error);
        if (alive) {
          setData(null);
          setLoadError(error.message || "Could not open this game.");
        }
      });

    return () => {
      alive = false;
    };
  }, [gameId, games]);

  const tps = useMemo(() => (data ? pickTurningPoints(data.record.userMoves) : []), [data]);
  const tp = tpIndex !== null ? tps[tpIndex] : null;
  const userColor = data?.game.userColor || "w";
  const flipped = (userColor === "b") !== flipExtra;
  const total = data ? data.parsed.moves.length : 0;

  const fen = data ? data.parsed.fens[cursor] : "";
  const currentMove = data && cursor > 0 ? data.moves[cursor - 1] : null;
  const awaitingGuess = Boolean(tp) && guessMode && !revealed;
  const answerShown = Boolean(tp) && !awaitingGuess;

  /* Kya ye position Leak Lab mein pehle se hai? */
  useEffect(() => {
    if (!tp || !data) return undefined;
    let alive = true;
    const id = `${data.game.id}:${tp.ply}`;

    dbGet("training", id)
      .then((row) => {
        if (alive && row) setAddedIds((prev) => ({ ...prev, [id]: true }));
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, [tp, data]);

  const targets = useMemo(() => {
    if (!selected || !awaitingGuess) return [];
    try {
      return new Chess(fen).moves({ square: selected, verbose: true }).map((m) => m.to);
    } catch {
      return [];
    }
  }, [selected, awaitingGuess, fen]);

  const selectTp = useCallback(
    (index) => {
      const point = tps[index];
      if (!point) return;
      setTpIndex(index);
      setCursor(point.ply - 1);
      setGuess(null);
      setRevealed(false);
      setSelected(null);
    },
    [tps]
  );

  const seek = useCallback((ply) => {
    setCursor(ply);
    setTpIndex(null);
    setGuess(null);
    setRevealed(false);
    setSelected(null);
  }, []);

  /* Keyboard: left / right */
  useEffect(() => {
    if (!data) return undefined;

    function onKey(event) {
      const tag = event.target?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT") return;

      if (event.key === "ArrowLeft") seek(Math.max(0, cursor - 1));
      else if (event.key === "ArrowRight") seek(Math.min(total, cursor + 1));
      else return;

      event.preventDefault();
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [data, cursor, total, seek]);

  function nextTurningPoint() {
    if (!tps.length) return;

    if (tpIndex !== null) {
      selectTp((tpIndex + 1) % tps.length);
      return;
    }

    const next = tps.findIndex((point) => point.ply - 1 > cursor);
    selectTp(next >= 0 ? next : 0);
  }

  function handleSquare(square) {
    if (!awaitingGuess) return;

    try {
      const chess = new Chess(fen);

      if (selected && targets.includes(square)) {
        const legal = chess.moves({ square: selected, verbose: true }).filter((m) => m.to === square);
        const move = legal.find((m) => !m.promotion || m.promotion === "q") || legal[0];
        if (!move) return;

        setGuess({ uci: move.from + move.to + (move.promotion || ""), san: move.san });
        setRevealed(true);
        setSelected(null);
        return;
      }

      const piece = chess.get(square);
      if (piece && piece.color === chess.turn() && chess.moves({ square, verbose: true }).length) {
        setSelected(square);
      } else {
        setSelected(null);
      }
    } catch (error) {
      console.error("Guess failed:", error);
    }
  }

  function replayPosition() {
    if (!tp) return;
    setCursor(tp.ply - 1);
    setGuess(null);
    setRevealed(false);
    setSelected(null);
  }

  async function addToLab() {
    if (!tp || !data) return;

    const id = `${data.game.id}:${tp.ply}`;
    const item = {
      id,
      gameId: data.game.id,
      ply: tp.ply,
      fen: tp.fenBefore,
      userColor,
      best: tp.best || "",
      bestSan: tp.bestSan || "",
      playedSan: tp.san,
      cat: tp.cat,
      leak: tp.leak || null,
      winLoss: tp.winLoss || 0,
      label: tp.label,
      addedAt: Date.now(),
      dueAt: Date.now(),
      box: 0,
      status: "new",
    };

    try {
      await dbPut("training", item);
      setAddedIds((prev) => ({ ...prev, [id]: true }));
    } catch (error) {
      console.error("Could not add to Leak Lab:", error);
    }
  }

  function changeGame(event) {
    const id = event.target.value;
    setGameId(id);
    setSetting("reviewGameId", id).catch(() => {});
  }

  function changeLang(next) {
    setLang(next);
    setSetting("language", next).catch(() => {});
  }

  /* ---------- Empty and loading states ---------- */

  if (games === null) {
    return (
      <div className="st-page">
        <p className="q-muted">Loading your games…</p>
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="st-page">
        <section className="q-card st-blank">
          <h1 className="q-title">No reviewed games yet</h1>
          <p className="q-muted">
            Review shows three turning points from a game you played. Add your games and let the engine check them first.
          </p>
          <button className="q-btn q-btn--primary" onClick={() => goTo("Connect")}>
            Add games
          </button>
        </section>
      </div>
    );
  }

  const evalNow = data ? (cursor === 0 ? data.moves[0]?.evalBefore : data.moves[cursor - 1]?.evalAfter) : null;
  const whiteShare = typeof evalNow === "number" ? winChance(evalNow) : 50;

  const opponentOf = (g) => (g.userColor === "b" ? g.white : g.black);
  const lastMove = currentMove ? { from: currentMove.from, to: currentMove.to } : null;
  const arrow =
    tp && answerShown && tp.best && tp.best !== tp.uci
      ? { from: tp.best.slice(0, 2), to: tp.best.slice(2, 4) }
      : null;

  const explanation = tp ? explainMoment(tp) : null;
  const myAcc = data ? data.summary.acc[userColor] : null;
  const oppAcc = data ? data.summary.acc[userColor === "w" ? "b" : "w"] : null;
  const myCounts = data ? data.summary.counts[userColor] : {};
  const sideName = userColor === "w" ? "White" : "Black";

  const rows = [];
  if (data) for (let i = 0; i < data.moves.length; i += 2) rows.push([data.moves[i], data.moves[i + 1]]);

  const tpDone = tp && answerShown;
  const otherLang = lang === "hi" ? "en" : "hi";

  return (
    <div className="st-page">
      {loadError && (
        <p className="st-error" role="alert">
          {loadError}
        </p>
      )}

      {data && (
        <div className="st-grid">
          {/* Left: board */}
          <section className="q-card st-boardcard">
            <div className="st-boardrow">
              <div className="st-evalbar" title={`White ${Math.round(whiteShare)}%`} aria-hidden="true">
                <div style={{ height: `${whiteShare}%`, [flipped ? "top" : "bottom"]: 0 }} />
              </div>
              <Board
                fen={fen}
                flipped={flipped}
                lastMove={lastMove}
                arrow={arrow}
                selected={selected}
                targets={targets}
                onSquareClick={awaitingGuess ? handleSquare : null}
              />
            </div>

            <div className="st-controls">
              <button className="st-ctl" onClick={() => seek(0)} disabled={cursor === 0} aria-label="Start">
                ⏮
              </button>
              <button className="st-ctl" onClick={() => seek(Math.max(0, cursor - 1))} disabled={cursor === 0} aria-label="Previous move">
                ◀
              </button>
              <button className="st-ctl" onClick={() => seek(Math.min(total, cursor + 1))} disabled={cursor === total} aria-label="Next move">
                ▶
              </button>
              <button className="st-ctl" onClick={() => seek(total)} disabled={cursor === total} aria-label="End">
                ⏭
              </button>
              <button className="st-ctl" onClick={() => setFlipExtra((v) => !v)} aria-label="Flip board">
                ⇅
              </button>
              <button className="st-next" onClick={nextTurningPoint} disabled={!tps.length}>
                Next turning point
              </button>
            </div>
          </section>

          {/* Middle: story + turning point */}
          <section className="st-mid">
            <select className="st-select" value={gameId || ""} onChange={changeGame} aria-label="Choose a game">
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.date ? new Date(g.date).toLocaleDateString() : "—"} · vs {opponentOf(g) || "Opponent"} ·{" "}
                  {g.opening || g.event || "Game"} · {g.result || "*"}
                </option>
              ))}
            </select>

            <div className="q-card st-storycard">
              <div className="st-storyhead">
                <span className="q-eyebrow">The story of this game</span>
                <span className="st-jump">Click to jump</span>
              </div>
              <StoryBar
                moves={data.moves}
                userColor={userColor}
                tps={tps}
                cursor={cursor}
                tpIndex={tpIndex}
                onSelectTp={selectTp}
                onSeek={seek}
              />
            </div>

            {tp ? (
              <div className="q-card st-tp">
                <div className="st-tp-head">
                  <span className="q-eyebrow">
                    Turning point {tpIndex + 1} of {tps.length} · Move {tp.moveNumber}
                  </span>
                  {tpDone && (
                    <span className="st-cat" style={{ "--cat": CATEGORIES[tp.cat].color }}>
                      {tp.cat}
                    </span>
                  )}
                </div>

                {awaitingGuess ? (
                  <>
                    <h2 className="st-h2">{sideName} to move. What would you play?</h2>
                    <p className="st-note">
                      Guess first mode is on: click a piece, then a square. The answer appears after you commit.
                    </p>
                    <div className="st-actions">
                      <button className="st-btn st-btn--primary" onClick={() => setRevealed(true)}>
                        Show answer
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <h2 className="st-h2">
                      You played {tp.san}
                      {tp.kind === "mistake" && tp.bestSan && <span className="st-better">Better: {betterLabel(tp)}</span>}
                    </h2>

                    {guessMode && <p className="st-note">Guess first mode is on: try to find the better move before this reveals.</p>}
                    {guess && <p className="st-guess">{guessFeedback(tp, guess, lang)}</p>}

                    <div className="st-why-head">
                      <span className="st-label">Why</span>
                      <button className={`st-lang ${lang === "en" ? "is-on" : ""}`} onClick={() => changeLang("en")}>
                        English
                      </button>
                      <button className={`st-lang ${lang === "hi" ? "is-on" : ""}`} onClick={() => changeLang("hi")}>
                        Hindi
                      </button>
                    </div>

                    <p className="st-why">
                      {lang === "hi" ? explanation.hi : explanation.en} {lang === "hi" ? explanation.askHi : explanation.askEn}
                    </p>

                    <div className="st-other">
                      <span className="st-label">
                        {otherLang === "hi" ? "Hindi (shown here in roman letters)" : "English"}
                      </span>
                      <p>
                        {otherLang === "hi" ? explanation.hi : explanation.en}{" "}
                        {otherLang === "hi" ? explanation.askHi : explanation.askEn}
                      </p>
                    </div>

                    <div className="st-actions">
                      <button
                        className="st-btn st-btn--primary"
                        onClick={addToLab}
                        disabled={addedIds[`${data.game.id}:${tp.ply}`]}
                      >
                        {addedIds[`${data.game.id}:${tp.ply}`] ? "Added to Leak Lab ✓" : "Add to Leak Lab"}
                      </button>
                      <button className="st-btn" onClick={replayPosition}>
                        Replay position
                      </button>
                      <button className="st-btn" onClick={() => setCursor(tp.ply)}>
                        Show my move
                      </button>
                    </div>
                  </>
                )}

                <label className="st-toggle">
                  <input type="checkbox" checked={guessMode} onChange={(e) => setGuessMode(e.target.checked)} />
                  Guess first mode
                </label>
              </div>
            ) : (
              <div className="q-card st-tp">
                {tps.length === 0 && (
                  <>
                    <h2 className="st-h2">A clean game</h2>
                    <p className="st-note">No big turning points here. Step through the moves with the arrow keys.</p>
                  </>
                )}

                {tps.length > 0 && (
                  <>
                    <h2 className="st-h2">Browsing the game</h2>
                    <p className="st-note">Click a numbered marker on the story graph, or press Next turning point.</p>
                  </>
                )}

                {currentMove && (
                  <div className="st-current">
                    <span className="st-dot" style={{ background: (CATEGORIES[currentMove.cat] || CATEGORIES.Pending).color }} />
                    <span>
                      {moveLabel(currentMove)} · {currentMove.cat}
                    </span>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Right: accuracy + moves */}
          <aside className="q-card st-side">
            <span className="st-label">You</span>
            <strong className="st-acc-num is-you">{typeof myAcc === "number" ? myAcc.toFixed(1) : "—"}</strong>

            <span className="st-label st-gap">Opponent</span>
            <strong className="st-acc-num is-opp">{typeof oppAcc === "number" ? oppAcc.toFixed(1) : "—"}</strong>
            <p className="st-acc-note">Accuracy, per side</p>

            <div className="st-divider" />

            <span className="st-label">Your moves</span>
            <ul className="st-counts">
              {CATEGORY_ORDER.filter((cat) => myCounts[cat]).map((cat) => (
                <li key={cat}>
                  <span className="st-count-name">
                    <i className="st-dot" style={{ background: CATEGORIES[cat].color }} /> {cat}
                  </span>
                  <strong>{myCounts[cat]}</strong>
                </li>
              ))}
            </ul>

            <div className="st-divider" />

            <button className="st-all" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
              All {total} moves {showAll ? "▴" : "▾"}
            </button>
            <p className="st-acc-note">Full list stays one click away.</p>

            {showAll && (
              <div className="st-moves">
                {rows.map((pair, r) => (
                  <div key={r} className="st-move-row">
                    <span className="st-move-no">{r + 1}.</span>
                    {pair.map((move, c) =>
                      move ? (
                        <button
                          key={move.ply}
                          className={`st-move ${cursor === move.ply ? "is-current" : ""}`}
                          onClick={() => seek(move.ply)}
                        >
                          <i className="st-dot" style={{ background: (CATEGORIES[move.cat] || CATEGORIES.Pending).color }} />
                          {move.san}
                        </button>
                      ) : (
                        <span key={`empty-${c}`} />
                      )
                    )}
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}