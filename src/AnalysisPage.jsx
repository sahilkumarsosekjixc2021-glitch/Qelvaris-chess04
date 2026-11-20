import { useEffect, useMemo, useRef, useState } from "react";
import Board from "./Board";
import { dbAll, dbGet, dbPut, getSetting } from "./storage";
import { CATEGORIES, CATEGORY_ORDER, parseGame, summarize, winChance } from "./chessUtils";
import { analyseGame } from "./leaks";
import { DEPTHS, useExplore } from "./useExplore";
import "./Analysis.css";
import "./AnalysisLayout.css"; // naya layout + teal theme (Analysis.css ke baad)

/*
  ANALYSIS: apni reviewed game ko chaal dar chaal dekho.
  - Board par engine ki sabse achhi chaal ka arrow aur top 3 alternatives
  - Kisi bhi line par click karke use board par chalo, ya khud chaal chalo (variation)
  - "Mistake" buttons seedha galtiyon par le jate hain
  - Galti ko ek click me Leak Lab ki training me daalo
  Koi bhi game na ho to "Free board" par kisi bhi position ko analyse karo.

  LAYOUT: upar game picker | board + controls (chhota) | move card + engine
          right column: move card, engine, graph, summary
          neeche: Moves (horizontal strip)
*/

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const SERIOUS = ["Mistake", "Miss", "Blunder"];
const DEPTH_LABEL = { 8: "Quick", 10: "Normal", 14: "Deep" };
const GLYPH = { Brilliant: "!!", Great: "!", Inaccuracy: "?!", Mistake: "?", Miss: "×", Blunder: "??" };

const catColor = (cat) => (CATEGORIES[cat] || CATEGORIES.Pending || {}).color || "#8c97ab";

/* Score white ke hisaab se: +0.34, −1.20, M3 */
function formatScore(line) {
  if (!line) return "…";
  if (line.mate !== null) return line.mate === 0 ? "#" : `${line.mate > 0 ? "+" : "−"}M${Math.abs(line.mate)}`;
  const pawns = line.cp / 100;
  if (pawns === 0) return "0.00";
  return `${pawns > 0 ? "+" : "−"}${Math.abs(pawns).toFixed(2)}`;
}

/* Chaalon ko move number ke saath: 12. Nf3 Nc6 13. d4 */
function numbered(fen, moves) {
  const parts = fen.split(" ");
  let white = parts[1] !== "b";
  let no = Number(parts[5]) || 1;

  return moves.map((move, idx) => {
    const prefix = white ? `${no}.` : idx === 0 ? `${no}…` : "";
    if (!white) no += 1;
    white = !white;
    return { idx, san: move.san, prefix };
  });
}

const moveNo = (index) => `${Math.floor(index / 2) + 1}${index % 2 === 0 ? "." : "…"}`;

export default function AnalysisPage() {
  const [games, setGames] = useState(null);
  const [gameId, setGameId] = useState("free");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [cursor, setCursor] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [inLab, setInLab] = useState(false);
  const [copied, setCopied] = useState("");
  const pendingRef = useRef(null); // "better move dekho" button ke liye
  const listRef = useRef(null);

  /* Reviewed games ki list */
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const all = (await dbAll("games"))
          .filter((g) => g.analysisComplete && g.pgn)
          .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
        const wanted = (await getSetting("selected-game", null)) || (await getSetting("reviewGameId", null));
        if (!alive) return;

        setGames(all);
        const first = all.find((g) => g.id === wanted) || all[0];
        if (first) setGameId(first.id);
      } catch (err) {
        console.error("Could not load games:", err);
        if (alive) setGames([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  /* Chuni hui game load */
  useEffect(() => {
    if (!games) return undefined;
    if (gameId === "free") {
      setData(null);
      setError("");
      setCursor(0);
      return undefined;
    }

    const game = games.find((g) => g.id === gameId);
    if (!game) return undefined;

    let alive = true;
    setError("");

    (async () => {
      try {
        const parsed = parseGame(game.pgn);
        const review = await dbGet("reviews", game.id);
        if (!review || !Array.isArray(review.moves) || review.moves.length !== parsed.moves.length) {
          throw new Error("This game has no saved review yet. Open it once in Review first.");
        }

        const moves = review.moves;
        const userColor = game.userColor || "w";
        const firstBad = moves.findIndex((m, i) => parsed.moves[i].color === userColor && SERIOUS.includes(m.cat));
        if (!alive) return;

        setData({ game, parsed, moves, userColor, record: analyseGame(game, parsed, moves), summary: summarize(moves) });
        setCursor(firstBad >= 0 ? firstBad + 1 : 0); // seedha pehli badi galti par
        setFlipped(userColor === "b");
      } catch (err) {
        console.error("Could not open game:", err);
        if (alive) {
          setData(null);
          setError(err.message || "Could not open this game.");
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [gameId, games]);

  const n = data ? data.parsed.moves.length : 0;
  const baseFen = data ? data.parsed.fens[cursor] : START_FEN;
  const ex = useExplore(baseFen, true);

  const best = ex.lines[0] || null;
  const move = data && cursor > 0 ? data.moves[cursor - 1] : null;
  const played = data && cursor > 0 ? data.parsed.moves[cursor - 1] : null;
  const isMine = Boolean(played && played.color === data.userColor);
  const hasBetter = Boolean(move && move.best && move.best !== move.uci);

  /* Eval bar: live engine se, warna review me saved value se */
  const storedEval = data ? (cursor === 0 ? data.moves[0]?.evalBefore : data.moves[cursor - 1]?.evalAfter) : null;
  let whiteShare = 50;
  if (best) {
    const cp = best.mate !== null ? (best.mate > 0 ? 2000 : -2000) : Math.max(-2000, Math.min(2000, best.cp));
    whiteShare = winChance(cp);
  } else if (typeof storedEval === "number") {
    whiteShare = winChance(storedEval);
  }

  /* Meri badi galtiyon ke positions (cursor ke hisaab se) */
  const mistakes = useMemo(() => {
    if (!data) return [];
    const list = [];
    data.moves.forEach((m, i) => {
      if (data.parsed.moves[i].color === data.userColor && SERIOUS.includes(m.cat)) list.push(i + 1);
    });
    return list;
  }, [data]);
  const prevBad = [...mistakes].reverse().find((c) => c < cursor);
  const nextBad = mistakes.find((c) => c > cursor);

  /* Graph ke points (White ke jeetne ke chance) */
  const points = useMemo(() => {
    if (!data || !n) return [];
    const list = [];
    for (let i = 0; i <= n; i += 1) {
      const value = i === 0 ? data.moves[0]?.evalBefore : data.moves[i - 1]?.evalAfter;
      list.push(typeof value === "number" ? { x: (i / n) * 600, y: 100 - winChance(value) } : null);
    }
    return list;
  }, [data, n]);

  const counts = useMemo(() => {
    const out = {};
    if (!data) return out;
    data.moves.forEach((m, i) => {
      if (data.parsed.moves[i].color === data.userColor) out[m.cat] = (out[m.cat] || 0) + 1;
    });
    return out;
  }, [data]);

  /* "Better move dekho": pehle chaal se pehle wali position par jao, phir best chaal chalo */
  useEffect(() => {
    if (pendingRef.current && data && ex.baseFen === data.parsed.fens[cursor]) {
      const uci = pendingRef.current;
      pendingRef.current = null;
      ex.playUci(uci);
    }
  }, [cursor, ex, data]);

  /* Chaal strip me current chaal beech me dikhti rahe (sirf strip scroll hoti hai, page nahi) */
  useEffect(() => {
    const box = listRef.current;
    const el = box?.querySelector(".an-mv.is-on");
    if (!box || !el) return;
    box.scrollTo({ left: el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2, behavior: "smooth" });
  }, [cursor]);

  /* "Add to Leak Lab" ki state */
  const itemId = data && move ? `${data.game.id}:${move.ply ?? cursor}` : null;
  useEffect(() => {
    let alive = true;
    setInLab(false);
    if (itemId && isMine && hasBetter) {
      dbGet("training", itemId)
        .then((item) => alive && setInLab(Boolean(item)))
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, [itemId, isMine, hasBetter]);

  /* Keyboard: <- -> Home End, F = flip, N / P = agli / pichli galti */
  useEffect(() => {
    function onKey(event) {
      const tag = event.target?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (ex.trail.length) ex.back();
        else setCursor((c) => Math.max(0, c - 1));
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setCursor((c) => Math.min(n, c + 1));
      } else if (event.key === "Home") {
        event.preventDefault();
        setCursor(0);
      } else if (event.key === "End") {
        event.preventDefault();
        setCursor(n);
      } else if (event.key === "f" || event.key === "F") {
        setFlipped((v) => !v);
      } else if ((event.key === "n" || event.key === "N") && nextBad !== undefined) {
        setCursor(nextBad);
      } else if ((event.key === "p" || event.key === "P") && prevBad !== undefined) {
        setCursor(prevBad);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ex, n, nextBad, prevBad]);

  async function addToLab() {
    if (!data || !move || !itemId) return;
    const rec = data.record.userMoves.find((m) => m.index === cursor - 1);
    const now = Date.now();

    try {
      await dbPut("training", {
        id: itemId,
        gameId: data.game.id,
        ply: move.ply ?? cursor,
        fen: data.parsed.fens[cursor - 1],
        userColor: data.userColor,
        best: move.best,
        bestSan: move.bestSan || "",
        playedSan: move.san,
        cat: move.cat,
        leak: rec?.leak || "other",
        winLoss: move.winLoss || 0,
        label: rec?.label || "your game",
        box: 0,
        dueAt: now,
        status: "new",
        attempts: 0,
        solved: 0,
        addedAt: now,
      });
      setInLab(true);
    } catch (err) {
      console.error("Could not add to Leak Lab:", err);
    }
  }

  async function copy(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(""), 1600);
    } catch {
      /* clipboard band ho to ignore */
    }
  }

  function seeBetter() {
    pendingRef.current = move.best;
    setCursor(cursor - 1);
  }

  /* ---------- Chhote render helpers ---------- */
  const lastMove = ex.trail.length
    ? ex.lastMove
    : played
    ? { from: played.from, to: played.to }
    : null;

  let statusText = "";
  const reached = ex.lines[0]?.depth || 0;
  if (ex.status === "error") statusText = ex.error;
  else if (ex.status === "running") statusText = reached ? `Thinking… depth ${reached} of ${ex.depth}` : "Starting the engine…";
  else if (ex.status === "done") statusText = ex.lines.length ? `Depth ${ex.depth} · Stockfish 19` : "No moves here. The game is over.";

  const trailTokens = numbered(ex.baseFen, ex.trail);

  // Component nahi, seedhi function: warna har render par saare buttons dobara ban jate
  function renderMove(idx) {
    const m = data.moves[idx];
    const mine = data.parsed.moves[idx].color === data.userColor;
    return (
      <button
        key={idx}
        type="button"
        className={`an-mv ${cursor === idx + 1 ? "is-on" : ""} ${mine ? "is-mine" : ""}`}
        onClick={() => setCursor(idx + 1)}
      >
        <i style={{ background: catColor(m.cat) }} aria-hidden="true" />
        {data.parsed.moves[idx].san}
        {GLYPH[m.cat] && <b style={{ color: catColor(m.cat) }}>{GLYPH[m.cat]}</b>}
      </button>
    );
  }

  const rows = [];
  for (let i = 0; i < n; i += 2) rows.push(i);

  return (
    <div className="an">
      {/* Upar: game chuno */}
      <div className="an-top">
        <label className="an-pick">
          <span className="ll-label">Game</span>
          <select value={gameId} onChange={(e) => setGameId(e.target.value)} aria-label="Choose a game">
            <option value="free">Free board (any position)</option>
            {(games || []).map((g) => {
              const opp = g.userColor === "b" ? g.white : g.black;
              return (
                <option key={g.id} value={g.id}>
                  {`vs ${opp || g.opponent || "Opponent"} · ${g.date ? new Date(g.date).toLocaleDateString() : "unknown date"}`}
                </option>
              );
            })}
          </select>
        </label>

        <div className="an-top-actions">
          <button type="button" className="ll-btn" onClick={() => setFlipped((v) => !v)}>
            Flip board
          </button>
          <button type="button" className="ll-btn" onClick={() => copy(ex.fen, "fen")}>
            {copied === "fen" ? "Copied" : "Copy FEN"}
          </button>
        </div>
      </div>

      {error && <p className="an-error" role="alert">{error}</p>}
      {games && games.length === 0 && gameId === "free" && (
        <p className="an-note">Review a game to analyse your own games here. Until then you can use the free board.</p>
      )}

      <div className="an-grid">
        {/* Left: chhota board + controls */}
        <div className="an-left">
          <div className="an-boardrow">
            <div className={`an-evalbar ${flipped ? "is-flipped" : ""}`} role="img" aria-label={`White winning chance ${Math.round(whiteShare)}%`} title={`White ${Math.round(whiteShare)}%`}>
              <div style={{ height: `${whiteShare}%` }} />
            </div>

            <div className="an-boardwrap">
              <Board
                fen={ex.fen}
                flipped={flipped}
                lastMove={lastMove}
                arrow={ex.arrow}
                selected={ex.selected}
                targets={ex.targets}
                onSquareClick={ex.squareClick}
              />
            </div>
          </div>

          <div className="an-controls" role="group" aria-label="Move through the game">
            <button type="button" className="ll-btn" onClick={() => setCursor(0)} disabled={!n || cursor === 0} aria-label="Start">«</button>
            <button type="button" className="ll-btn" onClick={() => (ex.trail.length ? ex.back() : setCursor((c) => Math.max(0, c - 1)))} disabled={!ex.trail.length && cursor === 0} aria-label="Previous move">‹</button>
            <button type="button" className="ll-btn" onClick={() => setCursor((c) => Math.min(n, c + 1))} disabled={cursor >= n} aria-label="Next move">›</button>
            <button type="button" className="ll-btn" onClick={() => setCursor(n)} disabled={!n || cursor >= n} aria-label="End">»</button>

            {data && (
              <>
                <button type="button" className="ll-btn an-bad" onClick={() => setCursor(prevBad)} disabled={prevBad === undefined}>
                  ‹ Mistake
                </button>
                <button type="button" className="ll-btn an-bad" onClick={() => setCursor(nextBad)} disabled={nextBad === undefined}>
                  Mistake ›
                </button>
              </>
            )}
          </div>
          <p className="an-keys">Keys: ← → move · N / P mistakes · F flip. You can also move the pieces yourself to try ideas.</p>
        </div>

        {/* Right: current move + engine */}
        <div className="an-right">
          <section className="an-card an-movecard">
            {move && played ? (
              <>
                <div className="an-row">
                  <span className="ll-label">{isMine ? "Your move" : "Opponent's move"}</span>
                  <span className="an-cat" style={{ "--cat": catColor(move.cat) }}>{move.cat}</span>
                </div>
                <h3>
                  {moveNo(cursor - 1)} {played.san}
                </h3>
                <p>
                  {hasBetter
                    ? `The engine preferred ${move.bestSan || "another move"}.${move.winLoss >= 1 ? ` This move cost ${Math.round(move.winLoss)}% winning chance.` : ""}`
                    : move.best === move.uci
                    ? "This was the engine's top move."
                    : "No clearly better move was found."}
                </p>
                <div className="an-actions">
                  {hasBetter && (
                    <button type="button" className="ll-btn ll-btn--primary" onClick={seeBetter}>
                      See the better move
                    </button>
                  )}
                  {isMine && hasBetter && (
                    <button type="button" className="ll-btn" onClick={addToLab} disabled={inLab}>
                      {inLab ? "In Leak Lab" : "Add to Leak Lab"}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <span className="ll-label">{data ? "Start position" : "Free board"}</span>
                <p>
                  {data
                    ? "Step through the game with the arrows, or jump to your mistakes."
                    : "Move any piece to try an idea. The engine shows the best moves for every position."}
                </p>
              </>
            )}
          </section>

          <section className="an-card an-engine">
            <div className="an-row">
              <div>
                <span className="ll-label">Engine</span>
                <strong className="an-score">{formatScore(best)}</strong>
              </div>
              <div className="an-depths" role="group" aria-label="Analysis depth">
                {DEPTHS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`an-depth ${ex.depth === d ? "is-on" : ""}`}
                    aria-pressed={ex.depth === d}
                    onClick={() => ex.setDepth(d)}
                  >
                    {DEPTH_LABEL[d] || d}
                  </button>
                ))}
              </div>
            </div>

            <p className={`an-status ${ex.status === "error" ? "is-error" : ""}`} aria-live="polite">{statusText}</p>
            {ex.status === "running" && (
              <div className="an-progress" aria-hidden="true">
                <span style={{ width: `${Math.min(100, Math.round((reached / ex.depth) * 100))}%` }} />
              </div>
            )}

            {ex.lines.length > 0 && (
              <ol className="an-lines">
                {ex.lines.map((line, i) => (
                  <li key={line.multipv} className={i === 0 ? "is-best" : ""}>
                    <span className="an-lscore">{formatScore(line)}</span>
                    <div className="an-lmoves">
                      {numbered(ex.fen, line.moves).map((tok) => (
                        <span key={tok.idx}>
                          {tok.prefix && <i>{tok.prefix}</i>}
                          <button type="button" onClick={() => ex.playLine(i, tok.idx)}>{tok.san}</button>
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ol>
            )}

            {ex.trail.length > 0 && (
              <div className="an-trail">
                <span className="ll-label">Your line</span>
                <p>
                  {trailTokens.map((tok) => (
                    <span key={tok.idx}>
                      {tok.prefix && <i>{tok.prefix}</i>}
                      <b>{tok.san}</b>
                    </span>
                  ))}
                </p>
                <div className="an-actions">
                  <button type="button" className="ll-btn" onClick={ex.back}>Undo</button>
                  <button type="button" className="ll-btn ll-btn--primary" onClick={ex.reset}>Back to game</button>
                </div>
              </div>
            )}
          </section>

          {/* Engine ke neeche (board ke saath ki khali jagah): graph + summary */}
      {data && (
        <>
          {points.length > 1 && (
            <section className="an-card">
              <span className="ll-label">How the game went (White's winning chance)</span>
              <div
                className="an-graph"
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  setCursor(Math.max(0, Math.min(n, Math.round(((event.clientX - rect.left) / rect.width) * n))));
                }}
              >
                <svg viewBox="0 0 600 100" preserveAspectRatio="none" aria-hidden="true">
                  <line x1="0" y1="50" x2="600" y2="50" className="an-mid" vectorEffect="non-scaling-stroke" />
                  <polygon
                    className="an-area"
                    points={`${points.filter(Boolean).map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")} 600,100 0,100`}
                  />
                  <polyline
                    className="an-line"
                    vectorEffect="non-scaling-stroke"
                    points={points.filter(Boolean).map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
                  />
                  <line x1={(cursor / n) * 600} y1="0" x2={(cursor / n) * 600} y2="100" className="an-cursor" vectorEffect="non-scaling-stroke" />
                </svg>

                {mistakes.map((c) => {
                  const p = points[c];
                  if (!p) return null;
                  return (
                    <button
                      key={c}
                      type="button"
                      className="an-dot"
                      style={{ left: `${(c / n) * 100}%`, top: `${p.y}%`, background: catColor(data.moves[c - 1].cat) }}
                      aria-label={`Go to ${data.moves[c - 1].cat} at move ${Math.ceil(c / 2)}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setCursor(c);
                      }}
                    />
                  );
                })}
              </div>
            </section>
          )}

          <section className="an-card">
            <span className="ll-label">Game summary</span>
            <p className="an-meta">
              {data.parsed.headers?.White || "White"} vs {data.parsed.headers?.Black || "Black"}
              {data.parsed.result ? ` · ${data.parsed.result}` : ""}
              {data.parsed.opening ? ` · ${data.parsed.opening}` : ""}
            </p>
            <div className="an-acc">
              <div>
                <strong>{typeof data.summary?.acc?.[data.userColor] === "number" ? `${Math.round(data.summary.acc[data.userColor])}%` : "—"}</strong>
                <span>Your accuracy</span>
              </div>
              <div>
                <strong>
                  {typeof data.summary?.acc?.[data.userColor === "w" ? "b" : "w"] === "number"
                    ? `${Math.round(data.summary.acc[data.userColor === "w" ? "b" : "w"])}%`
                    : "—"}
                </strong>
                <span>Opponent</span>
              </div>
            </div>
            <ul className="an-counts">
              {CATEGORY_ORDER.filter((cat) => counts[cat]).map((cat) => (
                <li key={cat} style={{ "--cat": catColor(cat) }}>
                  <i />
                  {cat} <b>{counts[cat]}</b>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
        </div>
      </div>

      {/* Neeche: Moves ek horizontal strip (kitni bhi moves ho, layout nahi badlega) */}
      {data && (
        <section className="an-card an-movesbar">
          <span className="ll-label">Moves</span>
          <ol className="an-moves" ref={listRef}>
            {rows.map((i) => (
              <li key={i}>
                <span className="an-no">{i / 2 + 1}.</span>
                {renderMove(i)}
                {i + 1 < n ? renderMove(i + 1) : <span />}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
