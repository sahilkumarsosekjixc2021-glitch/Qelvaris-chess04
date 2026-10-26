// Openings tree ka data layer.
// Aapki saved games ke PGN se moves padhta hai aur har line ka score nikalta hai.
// Aap White the ya Black: pehle game ka userColor/color field, warna "my-usernames" setting se naam match.

import { Chess } from "chess.js";
import { findOpening } from "./openings";
import { loadReviewedGames } from "./leaks";
import { dbAll, getSetting, setSetting } from "./storage";

export const MAX_PLIES = 10; // kitni chaal tak tree banega (10 = 5 poori moves)
export const MIN_GAMES = 2; // isse kam games ho toh rang nahi, "too few games"

export async function getUsernames() {
  const value = await getSetting("my-usernames", []);
  return Array.isArray(value) ? value : [];
}

export function saveUsernames(list) {
  return setSetting("my-usernames", list);
}

function userColor(game, names) {
  const direct = String(game.userColor || game.color || game.side || "").toLowerCase();
  if (direct.startsWith("w")) return "w";
  if (direct.startsWith("b")) return "b";

  const set = new Set(names.map((n) => n.trim().toLowerCase()).filter(Boolean));
  if (set.has(String(game.white || "").toLowerCase())) return "w";
  if (set.has(String(game.black || "").toLowerCase())) return "b";
  return null;
}

function outcome(result, color) {
  const r = String(result || "").replace("½", "1/2");
  if (r === "1-0") return color === "w" ? "win" : "loss";
  if (r === "0-1") return color === "w" ? "loss" : "win";
  if (r.startsWith("1/2")) return "draw";
  return null;
}

function newNode(san, ply) {
  return { san, ply, games: 0, win: 0, draw: 0, loss: 0, ids: [], kids: new Map() };
}

function finalize(node) {
  const children = [...node.kids.values()].map(finalize).sort((a, b) => b.games - a.games);
  const decided = node.win + node.draw + node.loss;
  return {
    san: node.san,
    ply: node.ply,
    games: node.games,
    ids: node.ids,
    score: decided ? (node.win + node.draw * 0.5) / decided : 0,
    children,
  };
}

// Return: { trees: {w, b}, usedCount: {w, b}, noColor, noMoves }
export async function buildTrees() {
  const [games, names, reviewed] = await Promise.all([
    dbAll("games"),
    getUsernames(),
    loadReviewedGames().catch(() => []),
  ]);
  const records = new Map(reviewed.map((record) => [record.id, record]));
  const roots = { w: newNode(null, 0), b: newNode(null, 0) };
  const usedCount = { w: 0, b: 0 };
  let noColor = 0;
  let noMoves = 0;

  for (const game of games) {
    const color = userColor(game, names);
    if (!color) {
      noColor += 1;
      continue;
    }

    let sans = [];
    try {
      const chess = new Chess();
      chess.loadPgn(String(game.pgn || ""));
      sans = chess.history().slice(0, MAX_PLIES);
    } catch {
      sans = [];
    }
    if (!sans.length) {
      noMoves += 1;
      continue;
    }

    const result = outcome(game.result, color);
    usedCount[color] += 1;

    let node = roots[color];
    const bump = (n) => {
      n.ids.push(game.id);
      n.games += 1;
      if (result) n[result] += 1;
    };
    bump(node);

    sans.forEach((san, i) => {
      if (!node.kids.has(san)) node.kids.set(san, newNode(san, i + 1));
      node = node.kids.get(san);
      bump(node);
    });
  }

  return {
    trees: { w: finalize(roots.w), b: finalize(roots.b) },
    usedCount,
    records,
    noColor,
    noMoves,
  };
}

/* ---------- Helpers ---------- */

export function lineLabel(path) {
  return path
    .map((san, i) => (i % 2 === 0 ? `${i / 2 + 1}.${san}` : san))
    .join(" ");
}

export function fenForPath(path) {
  const chess = new Chess();
  for (const san of path) {
    try {
      chess.move(san);
    } catch {
      break;
    }
  }
  return chess.fen();
}

export function nodeAt(root, path) {
  let node = root;
  for (const san of path) {
    node = node.children.find((c) => c.san === san);
    if (!node) return null;
  }
  return node;
}

export function scoreClass(node) {
  if (node.games < MIN_GAMES) return "few";
  if (node.score >= 0.6) return "good";
  if (node.score >= 0.45) return "mid";
  return "bad";
}

// Gaps: kam score wali lines (3+ games, 45% se neeche). Sabse gehri line hi leti hai, taaki ek hi cheez do baar na aaye.
export function findGaps(root, limit = 3) {
  const out = [];

  function visit(node, path) {
    const weak = node.ply > 0 && node.games >= 3 && node.score < 0.45;
    const weakKid = node.children.some((c) => c.games >= 3 && c.score < 0.45);
    if (weak && !weakKid) out.push({ path, node });
    node.children.forEach((c) => visit(c, [...path, c.san]));
  }

  visit(root, []);
  return out.sort((a, b) => b.node.games - a.node.games).slice(0, limit);
}

/* ---------- Naam, accuracy aur "book kahan chhoda" (reviewed games se) ---------- */

export function openingName(path) {
  return findOpening(path) || lineLabel(path);
}

const firstOutOfBook = (record) => {
  const move = record.userMoves.find((m) => m.cat !== "Book");
  return move ? move.moveNumber : null;
};

// node ki games mein se jo review ho chuki hain, unse: accuracy, aur sabse aam book-exit move
export function nodeStats(node, records) {
  const reviewed = node.ids.map((id) => records.get(id)).filter(Boolean);
  const accs = reviewed.map((r) => r.accuracy).filter((a) => typeof a === "number");
  const exits = reviewed.map(firstOutOfBook).filter((n) => n !== null);

  const counts = new Map();
  for (const n of exits) counts.set(n, (counts.get(n) || 0) + 1);
  let exit = null;
  for (const [move, count] of counts) {
    if (!exit || count > exit.count || (count === exit.count && move < exit.move)) exit = { move, count };
  }

  return {
    reviewed: reviewed.length,
    accuracy: accs.length ? accs.reduce((a, b) => a + b, 0) / accs.length : null,
    exit,
  };
}

// Tree khulte hi sabse zyada khelli gayi line chuni hui dikhe
export function defaultPath(root, maxDepth = 6) {
  const path = [];
  let node = root;
  while (node && node.children.length && path.length < maxDepth) {
    const next = node.children[0];
    if (next.games < MIN_GAMES) break;
    path.push(next.san);
    node = next;
  }
  return path;
}