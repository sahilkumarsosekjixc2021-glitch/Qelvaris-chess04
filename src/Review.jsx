import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import Board from "./Board";
import glassPawn from "./assets/glass-pawn.webp";
import { requestCoachLesson, TRAIN_MAP } from "./features/blindspot/blindspot"; // QV-BLINDSPOT
import { useT, getLang } from "./i18n/i18n"; // QV-I18N
import { rv } from "./i18n/pages/review"; // QV-I18N
import { lit } from "./i18n/pages/today"; // QV-I18N
import { bt } from "./features/blindspot/strings";
import PageLoader, { usePageLoaderDelay } from "./PageLoader";
import { dbAll, dbGet, dbPut, getSetting, setSetting } from "./storage";
import { CATEGORIES, CATEGORY_ORDER, parseGame, summarize, winChance } from "./chessUtils";
import { analyseGame as buildRecord } from "./leaks";
import { betterLabel, explainMoment, moveLabel, pickTurningPoints } from "./story";
import { useExplore } from "./useExplore";
import { setStepDone } from "./todayData"; // QV-STREAK
import ExplorePanel from "./ExplorePanel";
import "./Review.css";


/* Review khulne par loader kam se kam itni der (ms) dikhega.
   0 karoge to sirf real loading tak dikhega. */
const MIN_LOADER_MS = 0; // QV-PERF (pehle 1200)

function goTo(page) {
  window.dispatchEvent(new CustomEvent("qelvaris-navigate", { detail: page }));
}

async function loadGameData(game) {
  const parsed = parseGame(game.pgn);
  const review = await dbGet("reviews", game.id);

  if (!review || !Array.isArray(review.moves) || review.moves.length !== parsed.moves.length) {
    throw new Error("This game has no saved review yet."); // translated on display
  }

  const moves = review.moves;
  return { game, parsed, moves, record: buildRecord(game, parsed, moves), summary: summarize(moves) };
}

function guessFeedback(tp, guess) {
  if (!guess) return "";
  if (guess.uci === tp.best) return rv("gYes");
  if (guess.uci === tp.uci) return rv("gPlayed", { san: guess.san });
  return rv("gChose", { san: guess.san, best: tp.bestSan });
}

/* Move category ke liye chhota round badge (glyph + category ka apna color) */
const CAT_GLYPH = {
  Brilliant: "!!",
  Great: "!",
  Best: "★",
  Excellent: "✓",
  Good: "✓",
  Book: "B",
  Inaccuracy: "?!",
  Mistake: "?",
  Blunder: "??",
  Miss: "✕",
};

function CatBadge({ cat }) {
  const color = (CATEGORIES[cat] || CATEGORIES.Pending || {}).color || "#8c97ab";
  return (
    <i className="st-badge" style={{ "--cat": color }} aria-hidden="true">
      {CAT_GLYPH[cat] || "•"}
    </i>
  );
}

/* Accuracy ring: SVG circle, stroke-dasharray se bhara hua */
function AccRing({ value, tone, label }) {
  const gid = `st-ring-${useId().replace(/:/g, "")}`;
  const R = 46;
  const C = 2 * Math.PI * R;
  const has = typeof value === "number";
  const pct = has ? Math.max(0, Math.min(100, value)) : 0;

  return (
    <div className={`st-ring is-${tone}`} role="img" aria-label={rv("accAria", { who: label, value: has ? value.toFixed(1) : rv("unknown") })}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            {tone === "you" ? (
              <>
                <stop offset="0" stopColor="#3df5e6" />
                <stop offset="1" stopColor="#ff4fd8" />
              </>
            ) : (
              <>
                <stop offset="0" stopColor="#b6ff6a" />
                <stop offset="1" stopColor="#2fd37c" />
              </>
            )}
          </linearGradient>
        </defs>
        <circle className="st-ring-track" cx="60" cy="60" r={R} />
        <circle
          className="st-ring-bar"
          cx="60"
          cy="60"
          r={R}
          stroke={`url(#${gid})`}
          strokeDasharray={`${(pct / 100) * C} ${C}`}
        />
      </svg>
      <strong className="st-ring-num">{has ? value.toFixed(1) : "—"}</strong>
    </div>
  );
}

/* Graph line ka color: cyan -> violet -> pink (t = 0..1, game ke saath) */
function storyColor(t) {
  const stops = [
    [0, [61, 245, 230]],
    [0.55, [143, 155, 255]],
    [1, [255, 79, 216]],
  ];
  const x = Math.max(0, Math.min(1, t));
  const [a, b] = x <= 0.55 ? [stops[0], stops[1]] : [stops[1], stops[2]];
  const k = (x - a[0]) / (b[0] - a[0] || 1);
  const c = a[1].map((v, i) => Math.round(v + (b[1][i] - v) * k));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
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
  const area =
    known.length > 1 ? `${known[0].x.toFixed(1)},100 ${line} ${known[known.length - 1].x.toFixed(1)},100` : "";

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
        {area && <polygon points={area} className="st-story-area" />}
        {/* Gradient defs ki jagah har segment ko seedha color diya: har browser me dikhta hai */}
        {known.slice(1).map((p, i) => {
          const q = known[i];
          const color = storyColor((p.x + q.x) / 1200);
          const seg = `${q.x.toFixed(1)},${q.y.toFixed(1)} ${p.x.toFixed(1)},${p.y.toFixed(1)}`;
          return (
            <g key={i}>
              <polyline points={seg} className="st-story-glow" stroke={color} vectorEffect="non-scaling-stroke" />
              <polyline points={seg} className="st-story-line" stroke={color} vectorEffect="non-scaling-stroke" />
            </g>
          );
        })}
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
            aria-label={rv("tpN", { n: i + 1 })}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}

export default function Review() {
  useT(); // QV-I18N: re-render on language change
  const appLang = getLang();
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
  const [showAll, setShowAll] = useState(false);
  const [flipExtra, setFlipExtra] = useState(false);
  const [addedIds, setAddedIds] = useState({});
  const [tab, setTab] = useState("story");

  /* Loader: minimum time + pehli baar games/data aane tak */
  const minDone = usePageLoaderDelay(MIN_LOADER_MS);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    if (!booted && games !== null && (games.length === 0 || data || loadError)) setBooted(true);
  }, [booted, games, data, loadError]);

  /* Reviewed games ki list aur language */
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const all = (await dbAll("games"))
          .filter((g) => g.analysisComplete && g.pgn)
          .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

        const picked = await getSetting("selected-game", null);
        const wanted = picked || (await getSetting("reviewGameId", null));
        if (!alive) return;

        setGames(all);

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
          setLoadError(lit(error.message || "Could not open this game."));
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

  /* QV-STREAK: Today ka "Review" step tab poora jab user ne turning point par sach mein kuch kiya
     (guess ya show answer; ya guess-mode band ho to replay / Add to Leak Lab / Next turning point).
     Sirf page kholne se step complete nahi hota. */
  const reviewMarked = useRef(false);
  const markReview = useCallback(() => {
    if (reviewMarked.current) return;
    reviewMarked.current = true;
    setStepDone("review", true).catch(() => {
      reviewMarked.current = false;
    });
  }, []);

  useEffect(() => {
    if (tp && revealed) markReview();
  }, [tp, revealed, markReview]);

  /* Explore: guess karne se pehle band rehta hai, warna engine jawab bata deta */
  const showExplore = tab === "explore" && !awaitingGuess;
  const ex = useExplore(fen, showExplore);

  useEffect(() => {
    if (awaitingGuess && tab === "explore") setTab("story");
  }, [awaitingGuess, tab]);

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

      if (event.key === "ArrowLeft") {
        if (ex.active && ex.trail.length) ex.back();
        else seek(Math.max(0, cursor - 1));
      }
      else if (event.key === "ArrowRight") seek(Math.min(total, cursor + 1));
      else return;

      event.preventDefault();
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [data, cursor, total, seek, ex.active, ex.trail.length, ex.back]);

  function nextTurningPoint() {
    if (!tps.length) return;
    if (tp && !guessMode) markReview(); // QV-STREAK

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
    markReview(); // QV-STREAK
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
      markReview(); // QV-STREAK
    } catch (error) {
      console.error("Could not add to Leak Lab:", error);
    }
  }

  function changeGame(event) {
    const id = event.target.value;
    setGameId(id);
    setSetting("reviewGameId", id).catch(() => {});
  }

  /* ---------- Empty and loading states ---------- */

  if (!booted || !minDone) {
    return (
      <PageLoader
        page="review"
        title={rv("loadTitle")}
        messages={[rv("load1"), rv("load2"), rv("load3")]}
      />
    );
  }

  if (games.length === 0) {
    return (
      <div className="st-page">
        <section className="q-card st-blank">
          <h1 className="q-title">{rv("blankTitle")}</h1>
          <p className="q-muted">
            {rv("blankText")}
          </p>
          <button className="q-btn q-btn--primary" onClick={() => goTo("Connect")}>
            {rv("addGames")}
          </button>
        </section>
      </div>
    );
  }

  const evalNow = data ? (cursor === 0 ? data.moves[0]?.evalBefore : data.moves[cursor - 1]?.evalAfter) : null;
  const baseShare = typeof evalNow === "number" ? winChance(evalNow) : 50;
  const whiteShare = ex.active && ex.whiteShare !== null ? ex.whiteShare : baseShare;

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
  const sideName = userColor === "w" ? rv("gWhite") : rv("gBlack");

  const rows = [];
  if (data) for (let i = 0; i < data.moves.length; i += 2) rows.push([data.moves[i], data.moves[i + 1]]);

  const tpDone = tp && answerShown;

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
              <div className="st-evalbar" title={rv("whiteShare", { pct: Math.round(whiteShare) })} aria-hidden="true">
                <div style={{ height: `${whiteShare}%`, [flipped ? "top" : "bottom"]: 0 }} />
              </div>
              <Board
                fen={ex.active ? ex.fen : fen}
                flipped={flipped}
                lastMove={ex.active && ex.trail.length ? ex.lastMove : lastMove}
                arrow={ex.active ? ex.arrow : arrow}
                selected={ex.active ? ex.selected : selected}
                targets={ex.active ? ex.targets : targets}
                onSquareClick={ex.active ? ex.squareClick : awaitingGuess ? handleSquare : null}
              />
            </div>

            <div className="st-controls">
              <button className="st-ctl" onClick={() => seek(0)} disabled={cursor === 0} aria-label={rv("start")}>
                ⏮
              </button>
              <button className="st-ctl" onClick={() => seek(Math.max(0, cursor - 1))} disabled={cursor === 0} aria-label={rv("prev")}>
                ◀
              </button>
              <button className="st-ctl" onClick={() => seek(Math.min(total, cursor + 1))} disabled={cursor === total} aria-label={rv("next")}>
                ▶
              </button>
              <button className="st-ctl" onClick={() => seek(total)} disabled={cursor === total} aria-label={rv("end")}>
                ⏭
              </button>
              <button className="st-ctl" onClick={() => setFlipExtra((v) => !v)} aria-label={rv("flip")}>
                ⇅
              </button>
              <button className="st-next" onClick={nextTurningPoint} disabled={!tps.length}>
                {rv("nextTp")}
              </button>
            </div>
          </section>

          {/* Middle: story + turning point */}
          <section className="st-mid">
            <div className="st-gamebar">
              <select className="st-select" value={gameId || ""} onChange={changeGame} aria-label={rv("chooseGame")}>
                {games.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.date ? new Date(g.date).toLocaleDateString() : "—"} · {rv("vsOpp", { name: opponentOf(g) || lit("Opponent") })} ·{" "}
                    {g.opening || g.event || lit("Game")} · {g.result || "*"}
                  </option>
                ))}
              </select>
              <img className="st-gamebar-pawn" src={glassPawn} alt="" draggable="false" />
            </div>

            <div className="q-card st-storycard">
              <div className="st-storyhead">
                <span className="q-eyebrow">{rv("story")}</span>
                <span className="st-jump">{rv("jump")}</span>
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

            <div className="st-tabs" role="tablist" aria-label={rv("reviewView")}>
              <button
                type="button"
                role="tab"
                aria-selected={!showExplore}
                className={`st-tab ${!showExplore ? "is-on" : ""}`}
                onClick={() => setTab("story")}
              >
                {rv("tabStory")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={showExplore}
                className={`st-tab ${showExplore ? "is-on" : ""}`}
                disabled={awaitingGuess}
                title={awaitingGuess ? rv("guessFirst") : rv("exploreTip")}
                onClick={() => setTab("explore")}
              >
                {rv("tabExplore")}
              </button>
            </div>

            {showExplore ? (
              <ExplorePanel ex={ex} />
            ) : tp ? (
              <div className="q-card st-tp">
                <div className="st-tp-head">
                  <span className="q-eyebrow">
                    {rv("tpOf", { n: tpIndex + 1, total: tps.length, move: tp.moveNumber })}
                  </span>
                  {tpDone && (
                    <span className="st-cat" style={{ "--cat": CATEGORIES[tp.cat].color }}>
                      {lit(tp.cat)}
                    </span>
                  )}
                </div>

                {awaitingGuess ? (
                  <>
                    <h2 className="st-h2">{rv("toMove", { side: sideName })}</h2>
                    <p className="st-note">
                      {rv("guessOn")}
                    </p>
                    <div className="st-actions">
                      <button className="st-btn st-btn--primary" onClick={() => setRevealed(true)}>
                        {rv("showAnswer")}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <h2 className="st-h2">
                      {rv("youPlayed", { san: tp.san })}
                      {tp.kind === "mistake" && tp.bestSan && <span className="st-better">{rv("better", { move: betterLabel(tp) })}</span>}
                    </h2>

                    {guessMode && <p className="st-note">{rv("guessOnReveal")}</p>}
                    {guess && <p className="st-guess">{guessFeedback(tp, guess)}</p>}

                    <div className="st-why-head">
                      <span className="st-label">{rv("why")}</span>
                    </div>

                    <p className="st-why">
                      {explanation[appLang] ?? explanation.en} {explanation["ask" + appLang[0].toUpperCase() + appLang[1]] ?? explanation.askEn}
                    </p>

                    {appLang !== "en" && (
                      <div className="st-other">
                        <span className="st-label">{rv("inEnglish")}</span>
                        <p>
                          {explanation.en} {explanation.askEn}
                        </p>
                      </div>
                    )}

                    <div className="st-actions">
                      <button
                        className="st-btn st-btn--primary"
                        onClick={addToLab}
                        disabled={addedIds[`${data.game.id}:${tp.ply}`]}
                      >
                        {addedIds[`${data.game.id}:${tp.ply}`] ? rv("addedLab") : rv("addLab")}
                      </button>
                      <button className="st-btn" onClick={replayPosition}>
                        {rv("replay")}
                      </button>
                      {tp.kind === "mistake" && TRAIN_MAP[tp.leak] && (
                        <button className="st-btn" onClick={() => requestCoachLesson(tp.leak)}>
                          {bt("trainPattern")}
                        </button>
                      )}
                      <button className="st-btn" onClick={() => setCursor(tp.ply)}>
                        {rv("showMine")}
                      </button>
                    </div>
                  </>
                )}

                <label className="st-toggle">
                  <input type="checkbox" checked={guessMode} onChange={(e) => setGuessMode(e.target.checked)} />
                  {rv("guessMode")}
                </label>
              </div>
            ) : (
              <div className="q-card st-tp">
                {tps.length === 0 && (
                  <>
                    <h2 className="st-h2">{rv("clean")}</h2>
                    <p className="st-note">{rv("cleanText")}</p>
                  </>
                )}

                {tps.length > 0 && (
                  <>
                    <h2 className="st-h2">{rv("browsing")}</h2>
                    <p className="st-note">{rv("browsingText")}</p>
                  </>
                )}

                {currentMove && (
                  <div className="st-current">
                    <CatBadge cat={currentMove.cat} />
                    <span>
                      {moveLabel(currentMove)} · {lit(currentMove.cat)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Right: accuracy + moves */}
          <aside className="q-card st-side">
            <div className="st-acc-row">
              <span className="st-label">{rv("you")}</span>
              <AccRing value={myAcc} tone="you" label={rv("yours")} />
            </div>

            <div className="st-acc-row">
              <span className="st-label">{rv("opponent")}</span>
              <AccRing value={oppAcc} tone="opp" label={rv("opponent")} />
            </div>
            <p className="st-acc-note">{rv("accNote")}</p>

            <div className="st-divider" />

            <span className="st-label">{rv("yourMoves")}</span>
            <ul className="st-counts">
              {CATEGORY_ORDER.filter((cat) => myCounts[cat]).map((cat) => (
                <li key={cat} style={{ "--cat": CATEGORIES[cat].color }}>
                  <span className="st-count-name">
                    <CatBadge cat={cat} /> {lit(cat)}
                  </span>
                  <strong>{myCounts[cat]}</strong>
                </li>
              ))}
            </ul>

            <div className="st-divider" />

            <button className="st-all" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
              {rv("allMoves", { n: total })} {showAll ? "▴" : "▾"}
            </button>
            <p className="st-acc-note">{rv("listNote")}</p>

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