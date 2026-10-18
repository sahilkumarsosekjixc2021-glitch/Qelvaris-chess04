
import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "qelvarisSavedGames";

const styles = {
  page: { padding: 28, color: "var(--text, #e9eee9)" },
  muted: { color: "var(--muted, #89958c)", lineHeight: 1.6 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))",
    gap: 14,
    margin: "22px 0",
  },
  card: {
    background: "var(--panel, #111713)",
    border: "1px solid var(--border, #263229)",
    borderRadius: 14,
    padding: 18,
    minWidth: 0,
  },
  button: {
    background: "var(--panel-light, #151d17)",
    color: "var(--text, #e9eee9)",
    border: "1px solid var(--border, #263229)",
    padding: "10px 14px",
    borderRadius: 9,
    cursor: "pointer",
  },
};

function readGames() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function outcomeOf(game) {
  const result = String(game?.result || "").trim().toLowerCase();

  if (["1-0", "win", "won", "victory"].includes(result)) return "win";
  if (["0-1", "loss", "lost", "defeat"].includes(result)) return "loss";
  if (["1/2-1/2", "½-½", "draw", "drawn", "tie"].includes(result))
    return "draw";

  return "unknown";
}

function dateOf(game) {
  const raw = game?.date || game?.createdAt;
  if (!raw) return null;

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function moveCount(game) {
  if (Array.isArray(game?.moves)) return game.moves.length;

  if (typeof game?.pgn === "string" && game.pgn.trim()) {
    const body = game.pgn
      .replace(/\[[^\]]*\]/g, " ")
      .replace(/\{[^}]*\}/g, " ")
      .replace(/;[^\n]*/g, " ")
      .replace(/\([^)]*\)/g, " ")
      .replace(/\$\d+/g, " ")
      .replace(/\b\d+\.(?:\.\.)?/g, " ")
      .replace(/\b(1-0|0-1|1\/2-1\/2|\*)\b/g, " ");

    return body.trim() ? body.trim().split(/\s+/).length : 0;
  }

  return 0;
}

function dateLabel(date) {
  if (!date) return "Date unavailable";

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ProgressIntelligence() {
  const [games, setGames] = useState([]);

  const refresh = useCallback(() => setGames(readGames()), []);

  useEffect(() => {
    refresh();

    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);

  const report = useMemo(() => {
    const wins = games.filter((g) => outcomeOf(g) === "win").length;
    const losses = games.filter((g) => outcomeOf(g) === "loss").length;
    const draws = games.filter((g) => outcomeOf(g) === "draw").length;
    const known = wins + losses + draws;

    const dated = games
      .map((game) => ({ game, date: dateOf(game) }))
      .filter((item) => item.date)
      .sort((a, b) => b.date - a.date);

    const recent = dated.slice(0, 10);
    const recentKnown = recent.filter(
      (item) => outcomeOf(item.game) !== "unknown"
    );
    const recentWins = recentKnown.filter(
      (item) => outcomeOf(item.game) === "win"
    ).length;

    const totalMoves = games.reduce((sum, game) => sum + moveCount(game), 0);

    const recentActivity = dated.filter((item) => {
      const age = Date.now() - item.date.getTime();
      return age >= 0 && age <= 7 * 24 * 60 * 60 * 1000;
    }).length;

    const resultHistory = recent.slice(0, 8).reverse();

    return {
      total: games.length,
      wins,
      losses,
      draws,
      unknown: games.length - known,
      winRate: known ? Math.round((wins / known) * 100) : null,
      averageMoves: games.length
        ? Math.round(totalMoves / games.length)
        : null,
      recentActivity,
      recentWins,
      recentKnown: recentKnown.length,
      latest: dated.slice(0, 5),
      resultHistory,
    };
  }, [games]);

  function openPage(page) {
    window.dispatchEvent(
      new CustomEvent("qelvaris-navigate", { detail: page })
    );
  }

  return (
    <section style={styles.page}>
      <p className="eyebrow">PERFORMANCE DASHBOARD</p>
      <h1>Progress Intelligence</h1>
      <p style={styles.muted}>
        An overview of your recorded chess activity. Results are calculated
        from saved games; engine accuracy and rating changes are not inferred
        from game results alone.
      </p>

      <div style={styles.grid}>
        <div style={styles.card}>
          <p style={styles.muted}>Games saved</p>
          <h2>{report.total}</h2>
        </div>

        <div style={styles.card}>
          <p style={styles.muted}>Win rate</p>
          <h2>
            {report.winRate === null ? "—" : `${report.winRate}%`}
          </h2>
          <p style={styles.muted}>
            Calculated from games with a recognised result.
          </p>
        </div>

        <div style={styles.card}>
          <p style={styles.muted}>Last 7 days</p>
          <h2>{report.recentActivity}</h2>
          <p style={styles.muted}>Games with a usable saved date.</p>
        </div>

        <div style={styles.card}>
          <p style={styles.muted}>Average moves recorded</p>
          <h2>{report.averageMoves ?? "—"}</h2>
        </div>
      </div>

      <div style={styles.grid}>
        <div style={styles.card}>
          <h3>Results overview</h3>
          <p>Wins: {report.wins}</p>
          <p>Losses: {report.losses}</p>
          <p>Draws: {report.draws}</p>
          <p>Unrecognised results: {report.unknown}</p>
        </div>

        <div style={styles.card}>
          <h3>Recent performance</h3>
          <p style={styles.muted}>
            {report.recentKnown
              ? `${report.recentWins} wins from ${report.recentKnown} recent games with known results.`
              : "Save games with recognised results to see this summary."}
          </p>
          <p style={styles.muted}>
            This is a small recent sample, not a chess rating or skill estimate.
          </p>
        </div>
      </div>

      <div style={styles.card}>
        <h2>Recent saved games</h2>

        {!report.latest.length ? (
          <p style={styles.muted}>
            No dated saved games found yet. Play and save a game to start
            building your history.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {report.latest.map(({ game, date }, index) => {
              const outcome = outcomeOf(game);

              return (
                <div
                  key={game.id ?? `${date.toISOString()}-${index}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "center",
                    flexWrap: "wrap",
                    borderBottom: "1px solid var(--border, #263229)",
                    paddingBottom: 10,
                  }}
                >
                  <div>
                    <strong>{game.name || game.opponent || `Game ${index + 1}`}</strong>
                    <p style={styles.muted}>{dateLabel(date)}</p>
                  </div>

                  <span>
                    {outcome === "unknown"
                      ? "Result unavailable"
                      : outcome.charAt(0).toUpperCase() + outcome.slice(1)}
                    {" · "}
                    {moveCount(game)} moves
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ ...styles.grid, marginTop: 18 }}>
        <button
          style={styles.button}
          onClick={() => openPage("Game Review")}
        >
          Review saved games →
        </button>

        <button
          style={styles.button}
          onClick={() => openPage("Analysis Lab")}
        >
          Analyse a position →
        </button>

        <button
          style={styles.button}
          onClick={() => openPage("Chess Coach")}
        >
          Open Chess Coach →
        </button>
      </div>

      <button style={styles.button} onClick={refresh}>
        Refresh statistics
      </button>
    </section>
  );
}
