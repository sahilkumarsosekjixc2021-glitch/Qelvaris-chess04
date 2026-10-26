// Games library ka data layer.
// Saved games ke fields alag ho sakte hain, isliye saara "padhna" yahin hai (normalizeGame).
// Agar kuch galat dikhe toh sirf is file ke pick()/read*() functions badalne hain.

import { Chess } from "chess.js";
import { dbAll, dbPut } from "./storage";
import { LEAK_DEFS, loadReviewedGames } from "./leaks";

export const FILTERS = [
  { id: "all", label: "All" },
  { id: "lichess", label: "Lichess" },
  { id: "chesscom", label: "Chess.com" },
  { id: "bot", label: "Bot" },
  { id: "pgn", label: "PGN" },
  { id: "unreviewed", label: "Not reviewed" },
];

export const SOURCE_LABELS = { lichess: "Lichess", chesscom: "Chess.com", bot: "Bot", pgn: "PGN", other: "Saved" };

const LEAK_TITLES = new Map(LEAK_DEFS.map((def) => [def.id, def.title]));

// leaks.js ke record se is game ke leaks ke naam
function leakNames(record) {
  const ids = new Set();
  for (const move of record.userMoves) if (move.leak) ids.add(move.leak);
  for (const item of record.gameLeaks) ids.add(item.leakId);
  return [...ids].map((id) => LEAK_TITLES.get(id) || id);
}

function pick(obj, keys, fallback = null) {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
}

export function sourceKey(game) {
  const s = String(game?.source || "").toLowerCase();
  if (s.includes("lichess")) return "lichess";
  if (s.includes("chess.com") || s.includes("chesscom")) return "chesscom";
  if (s.includes("bot")) return "bot";
  if (s.includes("pgn") || s.includes("upload")) return "pgn";
  return "other";
}

function toTime(raw) {
  if (raw === null || raw === undefined || raw === "") return 0;
  if (typeof raw === "number") return raw;
  const t = new Date(String(raw).replace(/\./g, "-")).getTime();
  return Number.isFinite(t) ? t : 0;
}

function readAccuracy(review, game) {
  const a = review?.accuracy ?? game?.accuracy;
  if (typeof a === "number") return a;
  if (a && typeof a === "object") {
    const side = String(game?.userColor || game?.color || game?.side || "").toLowerCase();
    const value = side.startsWith("b") ? a.black : side.startsWith("w") ? a.white : null;
    if (typeof value === "number") return value;
  }
  return null;
}

function readLeaks(review) {
  const list = review?.leaks;
  if (!Array.isArray(list)) return null;
  return list.map((x) => (typeof x === "string" ? x : x?.name || x?.type)).filter(Boolean);
}

export function normalizeGame(game, review, record) {
  const key = sourceKey(game);
  const white = pick(game, ["white", "whiteName"], "?");
  const black = pick(game, ["black", "blackName"], "?");
  const time = toTime(pick(game, ["playedAt", "date", "createdAt", "savedAt"]));

  return {
    id: game.id,
    sourceKey: key,
    sourceLabel: SOURCE_LABELS[key],
    time,
    dateLabel: time ? new Date(time).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "–",
    players: pick(game, ["opponent"]) ? `vs ${game.opponent}` : `${white} – ${black}`,
    result: pick(game, ["result"], "*"),
    opening: pick(game, ["opening", "openingName"], "–"),
    accuracy: record && typeof record.accuracy === "number" ? record.accuracy : readAccuracy(review, game),
    leaks: record ? leakNames(record) : readLeaks(review),
    reviewed: Boolean(review || record),
  };
}

export async function loadGames() {
  const [games, reviews, records] = await Promise.all([
    dbAll("games"),
    dbAll("reviews"),
    loadReviewedGames().catch((error) => {
      console.error("Could not load leak records:", error);
      return [];
    }),
  ]);
  const byGame = new Map(reviews.map((r) => [r.gameId, r]));
  const recordById = new Map(records.map((r) => [r.id, r]));
  return games
    .map((g) => normalizeGame(g, byGame.get(g.id), recordById.get(g.id)))
    .sort((a, b) => b.time - a.time);
}

/* ---------- PGN import ---------- */

function splitPgn(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n(?=\[Event )/)
    .map((part) => part.trim())
    .filter(Boolean);
}

// Return: { added, skipped, failed }
export async function importPgnText(text) {
  const parts = splitPgn(text);
  const existing = await dbAll("games");
  const seen = new Set(existing.map((g) => g.pgn).filter(Boolean));

  let added = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < parts.length; i += 1) {
    const pgn = parts[i];
    if (seen.has(pgn)) {
      skipped += 1;
      continue;
    }

    try {
      const chess = new Chess();
      chess.loadPgn(pgn);
      const h = chess.getHeaders();

      await dbPut("games", {
        id: `pgn-${Date.now()}-${i}`,
        source: "pgn",
        pgn,
        white: h.White || "?",
        black: h.Black || "?",
        result: h.Result || "*",
        date: h.Date && !h.Date.includes("?") ? h.Date : null,
        playedAt: toTime(h.Date) || Date.now(),
        opening: h.Opening || null,
        fen: chess.fen(),
      });
      seen.add(pgn);
      added += 1;
    } catch (error) {
      console.error("PGN import failed:", error);
      failed += 1;
    }
  }

  return { added, skipped, failed };
}