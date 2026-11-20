/*
 * Pure game logic (no React). Wraps chess.js (v1.x) and adds the hidden-information rules.
 * Replace the chess.js calls here if you want to plug in your own move generator.
 */
import { Chess } from "chess.js";

const FILES = "abcdefgh";
let uid = 1;
export const sqToXY = (sq) => ({ f: sq.charCodeAt(0) - 97, r: Number(sq[1]) - 1 });
export const xyToSq = (f, r) => FILES[f] + (r + 1);

export function createGame() {
  const chess = new Chess();
  const ids = {}; // square -> stable piece id (lets the UI slide pieces)
  chess.board().forEach((row) => row.forEach((p) => { if (p) ids[p.square] = uid++; }));
  return { chess, ids, ply: 0 };
}

export function applyMove(game, { from, to, promotion }) {
  let mv;
  try { mv = game.chess.move({ from, to, promotion }); } catch (e) { return { ok: false }; }
  if (!mv) return { ok: false };
  const { ids } = game;
  if (mv.flags.includes("e")) delete ids[to[0] + from[1]];
  const id = ids[from];
  delete ids[from];
  delete ids[to];
  ids[to] = id;
  if (mv.flags.includes("k") || mv.flags.includes("q")) {
    const rank = from[1];
    const [rf, rt] = mv.flags.includes("k") ? ["h", "f"] : ["a", "d"];
    ids[rt + rank] = ids[rf + rank];
    delete ids[rf + rank];
  }
  game.ply += 1;
  return { ok: true, move: mv };
}

/* THE ONLY function the board uses to get pieces: opponent pieces are filtered out here,
 * so hidden pieces never reach the renderer. */
export function getVisiblePieces(game, viewer, cfg, over) {
  const v = cfg.visibility;
  const revealEnemy = v.showOpponentPieces || (over && v.revealOnGameOver);
  const out = [];
  game.chess.board().forEach((row) => row.forEach((p) => {
    if (!p) return;
    const own = p.color === viewer;
    if ((own && v.showOwnPieces) || (!own && revealEnemy))
      out.push({ id: game.ids[p.square], sq: p.square, type: p.type, color: p.color });
  }));
  return out;
}

/* Move hints for a selected own piece. */
export function hintsFor(game, viewer, from, cfg) {
  const exact = () => game.chess.moves({ square: from, verbose: true }).map((m) => ({ sq: m.to, kind: "move" }));
  if (cfg.hints === "exact") return exact();

  let rows = [];
  game.chess.board().forEach((row) => {
    let s = "", e = 0;
    row.forEach((p) => {
      if (!p || p.color !== viewer) { e++; return; }
      if (e) { s += e; e = 0; }
      s += p.color === "w" ? p.type.toUpperCase() : p.type;
    });
    rows.push(s + (e || ""));
  });
  let ghost;
  try {
    const castling = game.chess.fen().split(" ")[2];
    ghost = new Chess(`${rows.join("/")} ${viewer} ${castling} - 0 1`, { skipValidation: true });
  } catch (err) {
    console.warn("Echo-Trace: chess.js >= 1.0.0 is needed for ownBoard hints; falling back to exact hints.");
    return exact();
  }
  const out = ghost.moves({ square: from, verbose: true }).map((m) => ({ sq: m.to, kind: "move" }));
  const piece = game.chess.get(from);
  if (piece && piece.type === "p") {
    // diagonal capture attempts are always offered (they do not depend on hidden pieces)
    const { f, r } = sqToXY(from);
    const dir = viewer === "w" ? 1 : -1;
    [-1, 1].forEach((d) => {
      const nf = f + d, nr = r + dir;
      if (nf < 0 || nf > 7 || nr < 0 || nr > 7) return;
      const sq = xyToSq(nf, nr);
      const there = game.chess.get(sq);
      if ((!there || there.color !== viewer) && !out.some((h) => h.sq === sq)) out.push({ sq, kind: "try" });
    });
  }
  return out;
}

/* Builds the echo left behind by an opponent move. Never contains the piece itself. */
export function makeFootprint(move, ply, cfg) {
  const knight = move.piece === "n";
  const rule = knight ? cfg.knight : cfg.footprints;
  const a = sqToXY(move.from), b = sqToXY(move.to);
  const squares = [];
  if (rule.showOrigin) squares.push({ sq: move.from, kind: "origin" });
  if (rule.showPath) {
    const df = Math.sign(b.f - a.f), dr = Math.sign(b.r - a.r);
    let f = a.f + df, r = a.r + dr;
    while (f !== b.f || r !== b.r) {
      squares.push({ sq: xyToSq(f, r), kind: "path" });
      f += df; r += dr;
      if (f < 0 || f > 7 || r < 0 || r > 7) break;
    }
  }
  if (rule.showLanding) squares.push({ sq: move.to, kind: "landing" });
  return { id: `${ply}-${move.from}${move.to}`, ply, kind: knight ? "knight" : "normal", piece: move.piece, from: move.from, to: move.to, capture: !!move.captured, squares };
}

/* Returns the fade stage of a footprint, or null once it has disappeared. */
export function footprintStage(fp, currentPly, cfg) {
  const rule = fp.kind === "knight" ? cfg.knight : cfg.footprints;
  const age = currentPly - fp.ply;
  const stage = rule.stages.find((s) => age <= s.maxAge);
  return stage ? { ...stage, age } : null;
}

export function getStatus(game, viewer) {
  const c = game.chess;
  if (c.isCheckmate()) {
    const loser = c.turn();
    return { over: true, result: loser === viewer ? "loss" : "win", text: loser === viewer ? "Checkmate. You lost." : "Checkmate. You won!" };
  }
  if (c.isStalemate()) return { over: true, result: "draw", text: "Stalemate. Draw." };
  if (c.isDraw()) return { over: true, result: "draw", text: "Draw." };
  return { over: false, result: null, text: "" };
}

/* Placeholder opponent for practice mode. It reads the real board (it is a stand-in, not fair play). */
export function randomMove(game) {
  const moves = game.chess.moves({ verbose: true });
  if (!moves.length) return null;
  const caps = moves.filter((m) => m.captured);
  const pool = caps.length && Math.random() < 0.5 ? caps : moves;
  return pool[Math.floor(Math.random() * pool.length)];
}