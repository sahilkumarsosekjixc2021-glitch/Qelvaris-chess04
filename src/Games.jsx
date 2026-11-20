import { useCallback, useEffect, useMemo, useState } from "react";
import { askConfirm } from "./lib/confirm";
import { Chess } from "chess.js";
import Board from "./Board";
import boardArt from "./assets/games-board-clear.webp";
import GamesLoading from "./GamesLoading";


import { dbAll, dbDelete, getLocalJSON, setLocalJSON, setSetting } from "./storage"; // QV-ACCOUNT
import { parseGame } from "./chessUtils";
import { tx } from "./i18n/pages/games"; // QV-I18N
import { getLang } from "./i18n/i18n"; // QV-I18N
import "./Games.css";

const MIN_LOAD_MS = 0; // QV-PERF (pehle 1200)

const RESULT_LABEL = {
  "1-0": "White wins",
  "0-1": "Black wins",
  "1/2-1/2": "Draw",
  "*": "In progress",
};

function getOutcome(game) {
  if (game.result === "1/2-1/2") return "draw";
  if (game.result === "*") return "unfinished";
  if (game.result === "1-0") return game.userColor === "w" ? "win" : "loss";
  if (game.result === "0-1") return game.userColor === "b" ? "win" : "loss";
  return "other";
}

// Bot ke games alag, baaki sab (PGN / Lichess / Chess.com import) "imported" mein
function isBotGame(game) {
  return String(game?.source || "").toLowerCase().includes("bot");
}

function getOpponent(game) {
  return game.userColor === "b" ? game.white : game.black;
}

function formatDate(date) {
  if (!date) return tx("Date unavailable");
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime())
    ? tx("Date unavailable")
    : parsed.toLocaleDateString(getLang(), {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

function GameResult({ game }) {
  const outcome = getOutcome(game);
  return <span className={`gm-result gm-result--${outcome}`}>{outcome === "win" ? tx("Win") : outcome === "loss" ? tx("Loss") : outcome === "draw" ? tx("Draw") : outcome === "unfinished" ? tx("Unfinished") : game.result || "—"}</span>;
}

export default function Games() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("all");
  const [source, setSource] = useState("imported"); // "imported" ya "bot"
  const [search, setSearch] = useState("");
  const [openingFilter, setOpeningFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [selectedGame, setSelectedGame] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [ply, setPly] = useState(0);
  const [favourites, setFavourites] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [minDone, setMinDone] = useState(MIN_LOAD_MS <= 0);

  useEffect(() => {
    if (minDone) return undefined;
    const t = setTimeout(() => setMinDone(true), MIN_LOAD_MS);
    return () => clearTimeout(t);
  }, [minDone]);

  /* Navbar dropdown se tab chunna: all / win / loss / draw / saved */
  useEffect(() => {
    function onSubNavigate(event) {
      const detail = event.detail;
      if (!detail || detail.page !== "Games") return;

      if (["all", "win", "loss", "draw", "saved"].includes(detail.section)) {
        setTab(detail.section);
        setSelectedGame(null);
        setParsed(null);
        setPly(0);
      }
    }

    window.addEventListener("qelvaris-subnavigate", onSubNavigate);
    return () => window.removeEventListener("qelvaris-subnavigate", onSubNavigate);
  }, []);

  const loadGames = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [all, saved] = await Promise.all([
        dbAll("games"),
        Promise.resolve(getLocalJSON("qelvaris-game-favourites", [])),
      ]);
      const sorted = (all || []).filter((g) => g && g.pgn).sort(
        (a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
      );
      setGames(sorted);
      setFavourites(Array.isArray(saved) ? saved : []);
    } catch (err) {
      console.error("Games load failed:", err);
      setError(tx("Your game archive could not be loaded. Please refresh and try again."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGames();
  }, [loadGames]);

  // Sirf chuna hua source (imported / bot) ke games
  const sourceGames = useMemo(
    () => games.filter((g) => (source === "bot" ? isBotGame(g) : !isBotGame(g))),
    [games, source]
  );

  const sourceCounts = useMemo(() => ({
    imported: games.filter((g) => !isBotGame(g)).length,
    bot: games.filter((g) => isBotGame(g)).length,
  }), [games]);

  const openings = useMemo(
    () => [...new Set(sourceGames.map((g) => g.opening).filter(Boolean))].sort(),
    [sourceGames]
  );

  const counts = useMemo(() => ({
    all: sourceGames.length,
    win: sourceGames.filter((g) => getOutcome(g) === "win").length,
    loss: sourceGames.filter((g) => getOutcome(g) === "loss").length,
    draw: sourceGames.filter((g) => getOutcome(g) === "draw").length,
    saved: sourceGames.filter((g) => favourites.includes(g.id)).length,
  }), [sourceGames, favourites]);

  const filteredGames = useMemo(() => {
    const term = search.trim().toLowerCase();
    const now = new Date();

    return sourceGames.filter((game) => {
      const outcome = getOutcome(game);
      if (tab === "saved" && !favourites.includes(game.id)) return false;
      if (["win", "loss", "draw"].includes(tab) && outcome !== tab) return false;
      if (openingFilter !== "all" && game.opening !== openingFilter) return false;

      if (dateFilter !== "all" && game.date) {
        const date = new Date(game.date);
        const days = dateFilter === "7" ? 7 : dateFilter === "30" ? 30 : 365;
        if (Number.isNaN(date.getTime()) || (now - date) / 86400000 > days) return false;
      }

      if (term) {
        const haystack = [
          game.white, game.black, game.opening, game.event, game.source, game.result,
        ].join(" ").toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [sourceGames, tab, search, openingFilter, dateFilter, favourites]);

  function toggleFavourite(id) {
    setFavourites((previous) => {
      const next = previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id];
      setLocalJSON("qelvaris-game-favourites", next);
      return next;
    });
  }

  function openReplay(game) {
    try {
      const gameData = parseGame(game.pgn);
      if (!gameData?.fens?.length) throw new Error(tx("No replay positions found."));
      setSelectedGame(game);
      setParsed(gameData);
      setPly(0);
    } catch (err) {
      console.error("Replay failed:", err);
      setError(tx("This game's PGN could not be replayed."));
    }
  }

  function closeReplay() {
    setSelectedGame(null);
    setParsed(null);
    setPly(0);
  }

  async function openReview(game) {
    if (!game.analysisComplete) {
      setError(tx("This game has not been analysed yet. Only reviewed games can open in Review."));
      return;
    }
    await setSetting("selected-game", game.id);
    window.dispatchEvent(new CustomEvent("qelvaris-navigate", { detail: "Review" }));
  }

  async function deleteGame(game) {
    const confirmed = await askConfirm(tx("Delete this game permanently? Its saved review will also be removed."), { danger: true });
    if (!confirmed) return;
    setDeleting(true);
    try {
      await dbDelete("games", game.id);
      await dbDelete("reviews", game.id);
      setGames((previous) => previous.filter((item) => item.id !== game.id));
      setFavourites((previous) => {
        const next = previous.filter((id) => id !== game.id);
        setLocalJSON("qelvaris-game-favourites", next);
        return next;
      });
      if (selectedGame?.id === game.id) closeReplay();
    } catch (err) {
      console.error("Delete failed:", err);
      setError(tx("Could not delete this game."));
    } finally {
      setDeleting(false);
    }
  }

  const currentFen = parsed?.fens?.[ply] || new Chess().fen();
  const lastMove = parsed?.moves?.[ply - 1]
    ? { from: parsed.moves[ply - 1].from, to: parsed.moves[ply - 1].to }
    : null;
  const totalPlies = parsed?.moves?.length || 0;

  if (loading || !minDone) return <GamesLoading />;

  if (selectedGame && parsed) {
    return (
      <main className="gm-page">
        <div className="gm-replay-top">
          <button className="gm-back" onClick={closeReplay}>{tx("← Back to Games")}</button>
          <div>
            <span className="gm-eyebrow">{tx("GAME REPLAY")}</span>
            <h1>{selectedGame.white || tx("White")} <span>{tx("vs")}</span> {selectedGame.black || tx("Black")}</h1>
            <p>{formatDate(selectedGame.date)} · {selectedGame.opening || tx("Unclassified opening")} · {selectedGame.result}</p>
          </div>
          <GameResult game={selectedGame} />
        </div>

        <div className="gm-replay-layout">
          <section className="gm-panel gm-replay-board">
            <div className="gm-board-wrap">
              <Board fen={currentFen} flipped={selectedGame.userColor === "b"} lastMove={lastMove} />
            </div>
            <div className="gm-replay-controls">
              <button onClick={() => setPly(0)} disabled={ply === 0} aria-label={tx("Start")}>|◀</button>
              <button onClick={() => setPly((v) => Math.max(0, v - 1))} disabled={ply === 0} aria-label={tx("Previous move")}>←</button>
              <span>{ply} / {totalPlies}</span>
              <button onClick={() => setPly((v) => Math.min(totalPlies, v + 1))} disabled={ply >= totalPlies} aria-label={tx("Next move")}>→</button>
              <button onClick={() => setPly(totalPlies)} disabled={ply >= totalPlies}>▶|</button>
            </div>
            <div className="gm-replay-actions">
              <button className="gm-primary" disabled={!selectedGame.analysisComplete} onClick={() => openReview(selectedGame)}>{tx("Open in Review ↗")}</button>
              <button onClick={() => toggleFavourite(selectedGame.id)}>{favourites.includes(selectedGame.id) ? tx("★ Saved") : tx("☆ Save game")}</button>
            </div>
          </section>

          <aside className="gm-panel gm-move-panel">
            <span className="gm-eyebrow">{tx("MOVE HISTORY")}</span>
            <h2>{tx("Game notation")}</h2>
            <div className="gm-move-list">
              {Array.from({ length: Math.ceil(totalPlies / 2) }, (_, index) => {
                const white = parsed.moves[index * 2];
                const black = parsed.moves[index * 2 + 1];
                return (
                  <div className="gm-move-row" key={index}>
                    <span>{index + 1}.</span>
                    <button className={ply === index * 2 + 1 ? "is-active" : ""} onClick={() => setPly(index * 2 + 1)}>{white?.san || "—"}</button>
                    {black && <button className={ply === index * 2 + 2 ? "is-active" : ""} onClick={() => setPly(index * 2 + 2)}>{black.san}</button>}
                  </div>
                );
              })}
            </div>
          </aside>
        </div>
      </main>
    );
  }

  return (
    <main className="gm-page">
      <header className="gm-header">
        <div>
          <span className="gm-eyebrow">{tx("YOUR CHESS ARCHIVE")}</span>
          <h1>{tx("Games")}</h1>
          <p>{tx("Every game tells a story. Revisit your moves, track your results and learn from every match.")}</p>
        </div>
        <img className="gm-header-art" src={boardArt} alt="" draggable="false" aria-hidden="true" />
        <button className="gm-refresh" onClick={loadGames}>{tx("↻ Refresh archive")}</button>
      </header>

      {error && <div className="gm-error" role="alert">{error}<button onClick={() => setError("")} aria-label={tx("Close message")}>×</button></div>}

      <section className="gm-stats">
        <article className="gm-stat gm-stat--total"><i className="gm-stat-icon" aria-hidden="true">♟</i><span>{tx("Total games")}</span><strong>{counts.all}</strong><small>{tx("Saved in your archive")}</small></article>
        <article className="gm-stat gm-stat--win"><i className="gm-stat-icon" aria-hidden="true">♛</i><span>{tx("Wins")}</span><strong>{counts.win}</strong><small>{tx("Games you won")}</small></article>
        <article className="gm-stat gm-stat--loss"><i className="gm-stat-icon" aria-hidden="true">♜</i><span>{tx("Losses")}</span><strong>{counts.loss}</strong><small>{tx("Learning opportunities")}</small></article>
        <article className="gm-stat gm-stat--draw"><i className="gm-stat-icon" aria-hidden="true">♝</i><span>{tx("Draws")}</span><strong>{counts.draw}</strong><small>{tx("Shared results")}</small></article>
      </section>

      <section className="gm-archive">
        <div className="gm-archive-heading">
          <div><span className="gm-eyebrow">{tx("PERSONAL COLLECTION")}</span><h2>{source === "bot" ? tx("Bot games") : tx("Imported games")}</h2></div>
          <span className="gm-total">{tx("{n} games", { n: filteredGames.length })}</span>
        </div>

        <div className="gm-tabs gm-source-tabs">
          {[["imported",tx("Imported games")],["bot",tx("Bot games")]].map(([id,label]) => (
            <button
              key={id}
              className={source === id ? "is-active" : ""}
              onClick={() => { setSource(id); setTab("all"); setOpeningFilter("all"); }}
            >
              {label}<span>{sourceCounts[id]}</span>
            </button>
          ))}
        </div>

        <div className="gm-tabs">
          {[["all",tx("All games")],["win",tx("Wins")],["loss",tx("Losses")],["draw",tx("Draws")],["saved",tx("Saved")]].map(([id,label]) => (
            <button key={id} className={tab === id ? "is-active" : ""} onClick={() => setTab(id)}>
              {label}<span>{counts[id]}</span>
            </button>
          ))}
        </div>

        <div className="gm-filters">
          <label className="gm-search"><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tx("Search opponent, opening or event…")} /></label>
          <select value={openingFilter} onChange={(e) => setOpeningFilter(e.target.value)}>
            <option value="all">{tx("All openings")}</option>
            {openings.map((opening) => <option key={opening} value={opening}>{opening}</option>)}
          </select>
          <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
            <option value="all">{tx("Any time")}</option><option value="7">{tx("Last 7 days")}</option><option value="30">{tx("Last 30 days")}</option><option value="365">{tx("Last year")}</option>
          </select>
        </div>

        {filteredGames.length === 0 ? (
          <div className="gm-empty">
            <div className="gm-empty-icon">♟</div>
            <h3>{sourceGames.length ? tx("No games match these filters") : source === "bot" ? tx("No bot games yet") : tx("No imported games yet")}</h3>
            <p>{sourceGames.length ? tx("Try changing your search or filters.") : source === "bot" ? tx("Play a game against the bot. Completed games will appear here once they are saved.") : tx("Import a PGN file. Imported games will appear here.")}</p>
            {sourceGames.length > 0 && <button onClick={() => {setTab("all");setSearch("");setOpeningFilter("all");setDateFilter("all");}}>{tx("Clear filters")}</button>}
          </div>
        ) : (
          <div className="gm-game-list">
            {filteredGames.map((game) => (
              <article className={`gm-game-card gm-game-card--${getOutcome(game)}`} key={game.id}>
                <div className="gm-game-icon">♞</div>
                <div className="gm-game-main">
                  <div className="gm-game-title">
                    <strong>{game.white || tx("White")} <span>{tx("vs")}</span> {game.black || tx("Black")}</strong>
                    <GameResult game={game} />
                  </div>
                  <div className="gm-game-meta">
                    <span>{formatDate(game.date)}</span><i>·</i><span>{game.opening || tx("Opening not recorded")}</span><i>·</i><span>{tx("{n} moves", { n: game.moves || 0 })}</span>
                  </div>
                  <div className="gm-game-extra">
                    <span>{isBotGame(game) ? tx("Qelvaris Bot") : game.source === "pgn" ? tx("Imported PGN") : game.source || tx("Imported game")}</span>
                    {game.analysisComplete && <span className="gm-reviewed">{tx("✓ Reviewed")}</span>}
                    {typeof game.accuracy === "number" && <span>{tx("{acc} accuracy", { acc: Number(game.accuracy).toFixed(1) })}</span>}
                  </div>
                </div>
                <div className="gm-game-actions">
                  <button onClick={() => openReplay(game)}>{tx("Replay")}</button>
                  <button className="gm-review-btn" disabled={!game.analysisComplete} onClick={() => openReview(game)}>{tx("Review ↗")}</button>
                  <button className="gm-icon-btn" title={favourites.includes(game.id) ? tx("Remove from saved") : tx("Save game")} onClick={() => toggleFavourite(game.id)}>{favourites.includes(game.id) ? "★" : "☆"}</button>
                  <button className="gm-icon-btn gm-delete" title={tx("Delete game")} disabled={deleting} onClick={() => deleteGame(game)}>⋯</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <footer className="gm-footer">{tx("Your games are stored locally in your Qelvaris archive.")}</footer>
    </main>
  );
}