// Qelvaris — built-in basic chess engine (Stockfish na mile tab fallback).
// Kisi library par depend nahi karta (apna move generator, 0x88 board). UCI ka chhota hissa bolta hai,
// isliye uciEngine.js ka client isse bhi waise hi baat karta hai jaise Stockfish se.
// Ye Stockfish se bahut kamzor hai (kuch ply gehra sochta hai): practice ke liye theek, serious analysis ke liye nahi.

const WHITE = 0;
const BLACK = 1;
const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;
const VALUE = [0, 100, 320, 330, 500, 900, 0];
const KNIGHT_D = [-33, -31, -18, -14, 14, 18, 31, 33];
const KING_D = [-17, -16, -15, -1, 1, 15, 16, 17];
const BISHOP_D = [-17, -15, 15, 17];
const ROOK_D = [-16, -1, 1, 16];
const MATE = 30000;
const INF = 32000;
const FILES = "abcdefgh";

const CASTLE_MASK = new Uint8Array(128).fill(15);
CASTLE_MASK[0] = 13;
CASTLE_MASK[4] = 12;
CASTLE_MASK[7] = 14;
CASTLE_MASK[112] = 7;
CASTLE_MASK[116] = 3;
CASTLE_MASK[119] = 11;

// Piece-square tables (rank 8 se rank 1 tak, a se h tak)
const PST = [
  null,
  [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
  [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
  [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
  [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
  [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
  [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20],
];

const sqName = (sq) => FILES[sq & 7] + ((sq >> 4) + 1);
const sqFromName = (s) => (s.charCodeAt(1) - 49) * 16 + (s.charCodeAt(0) - 97);

export function createPosition() {
  return { board: new Int8Array(128), side: WHITE, castling: 0, ep: -1, half: 0, full: 1, king: [0, 0], stack: [] };
}

export function setFen(pos, fen) {
  pos.board.fill(0);
  pos.stack.length = 0;
  const [placement, side, castle, ep, half, full] = fen.trim().split(/\s+/);
  let rank = 7;
  let file = 0;
  for (const ch of placement) {
    if (ch === "/") {
      rank -= 1;
      file = 0;
    } else if (ch >= "1" && ch <= "8") {
      file += Number(ch);
    } else {
      const color = ch === ch.toUpperCase() ? WHITE : BLACK;
      const type = "pnbrqk".indexOf(ch.toLowerCase()) + 1;
      const sq = rank * 16 + file;
      pos.board[sq] = type | (color << 3);
      if (type === K) pos.king[color] = sq;
      file += 1;
    }
  }
  pos.side = side === "b" ? BLACK : WHITE;
  pos.castling = 0;
  const c = castle || "-";
  if (c.includes("K")) pos.castling |= 1;
  if (c.includes("Q")) pos.castling |= 2;
  if (c.includes("k")) pos.castling |= 4;
  if (c.includes("q")) pos.castling |= 8;
  pos.ep = ep && ep !== "-" ? sqFromName(ep) : -1;
  pos.half = Number(half) || 0;
  pos.full = Number(full) || 1;
}

export function isAttacked(pos, sq, by) {
  const b = pos.board;
  const bc = by << 3;
  let s;

  if (by === WHITE) {
    s = sq - 15;
    if (!(s & 0x88) && b[s] === (P | bc)) return true;
    s = sq - 17;
    if (!(s & 0x88) && b[s] === (P | bc)) return true;
  } else {
    s = sq + 15;
    if (!(s & 0x88) && b[s] === (P | bc)) return true;
    s = sq + 17;
    if (!(s & 0x88) && b[s] === (P | bc)) return true;
  }

  for (const d of KNIGHT_D) {
    s = sq + d;
    if (!(s & 0x88) && b[s] === (N | bc)) return true;
  }
  for (const d of KING_D) {
    s = sq + d;
    if (!(s & 0x88) && b[s] === (K | bc)) return true;
  }
  for (const d of BISHOP_D) {
    s = sq + d;
    while (!(s & 0x88)) {
      const p = b[s];
      if (p) {
        if (p >> 3 === by) {
          const t = p & 7;
          if (t === B || t === Q) return true;
        }
        break;
      }
      s += d;
    }
  }
  for (const d of ROOK_D) {
    s = sq + d;
    while (!(s & 0x88)) {
      const p = b[s];
      if (p) {
        if (p >> 3 === by) {
          const t = p & 7;
          if (t === R || t === Q) return true;
        }
        break;
      }
      s += d;
    }
  }
  return false;
}

export function inCheck(pos) {
  return isAttacked(pos, pos.king[pos.side], pos.side ^ 1);
}

const mk = (from, to, piece, cap, promo, flag) => ({ from, to, piece, cap, promo, flag, score: 0 });

export function genMoves(pos, capsOnly) {
  const moves = [];
  const b = pos.board;
  const us = pos.side;
  const them = us ^ 1;

  for (let sq = 0; sq < 128; sq += 1) {
    if (sq & 0x88) {
      sq += 7;
      continue;
    }
    const p = b[sq];
    if (!p || p >> 3 !== us) continue;
    const t = p & 7;

    if (t === P) {
      const dir = us === WHITE ? 16 : -16;
      const startRank = us === WHITE ? 1 : 6;
      const promoRank = us === WHITE ? 6 : 1;
      const rank = sq >> 4;
      let to = sq + dir;

      if (!(to & 0x88) && b[to] === 0) {
        if (rank === promoRank) {
          for (const promo of capsOnly ? [Q] : [Q, R, B, N]) moves.push(mk(sq, to, p, 0, promo, 0));
        } else if (!capsOnly) {
          moves.push(mk(sq, to, p, 0, 0, 0));
          if (rank === startRank && b[to + dir] === 0) moves.push(mk(sq, to + dir, p, 0, 0, 4));
        }
      }

      for (const dc of [dir - 1, dir + 1]) {
        to = sq + dc;
        if (to & 0x88) continue;
        const c = b[to];
        if (c && c >> 3 === them) {
          if (rank === promoRank) {
            for (const promo of capsOnly ? [Q] : [Q, R, B, N]) moves.push(mk(sq, to, p, c, promo, 0));
          } else {
            moves.push(mk(sq, to, p, c, 0, 0));
          }
        } else if (!c && to === pos.ep) {
          moves.push(mk(sq, to, p, P | (them << 3), 0, 1));
        }
      }
    } else if (t === N || t === K) {
      const offsets = t === N ? KNIGHT_D : KING_D;
      for (const d of offsets) {
        const to = sq + d;
        if (to & 0x88) continue;
        const c = b[to];
        if (c) {
          if (c >> 3 === them) moves.push(mk(sq, to, p, c, 0, 0));
        } else if (!capsOnly) {
          moves.push(mk(sq, to, p, 0, 0, 0));
        }
      }

      if (t === K && !capsOnly) {
        if (us === WHITE && sq === 4) {
          if ((pos.castling & 1) && !b[5] && !b[6] && b[7] === R && !isAttacked(pos, 4, them) && !isAttacked(pos, 5, them) && !isAttacked(pos, 6, them)) {
            moves.push(mk(4, 6, p, 0, 0, 2));
          }
          if ((pos.castling & 2) && !b[3] && !b[2] && !b[1] && b[0] === R && !isAttacked(pos, 4, them) && !isAttacked(pos, 3, them) && !isAttacked(pos, 2, them)) {
            moves.push(mk(4, 2, p, 0, 0, 2));
          }
        } else if (us === BLACK && sq === 116) {
          const rook = R | 8;
          if ((pos.castling & 4) && !b[117] && !b[118] && b[119] === rook && !isAttacked(pos, 116, them) && !isAttacked(pos, 117, them) && !isAttacked(pos, 118, them)) {
            moves.push(mk(116, 118, p, 0, 0, 2));
          }
          if ((pos.castling & 8) && !b[115] && !b[114] && !b[113] && b[112] === rook && !isAttacked(pos, 116, them) && !isAttacked(pos, 115, them) && !isAttacked(pos, 114, them)) {
            moves.push(mk(116, 114, p, 0, 0, 2));
          }
        }
      }
    } else {
      const dirs = t === B ? BISHOP_D : t === R ? ROOK_D : BISHOP_D.concat(ROOK_D);
      for (const d of dirs) {
        let to = sq + d;
        while (!(to & 0x88)) {
          const c = b[to];
          if (c) {
            if (c >> 3 === them) moves.push(mk(sq, to, p, c, 0, 0));
            break;
          }
          if (!capsOnly) moves.push(mk(sq, to, p, 0, 0, 0));
          to += d;
        }
      }
    }
  }

  return moves;
}

export function makeMove(pos, m) {
  const b = pos.board;
  const us = pos.side;
  pos.stack.push({ castling: pos.castling, ep: pos.ep, half: pos.half });

  b[m.from] = 0;
  if (m.flag === 1) b[m.to + (us === WHITE ? -16 : 16)] = 0;
  b[m.to] = m.promo ? m.promo | (us << 3) : m.piece;

  if (m.flag === 2) {
    if (m.to === m.from + 2) {
      b[m.from + 1] = b[m.from + 3];
      b[m.from + 3] = 0;
    } else {
      b[m.from - 1] = b[m.from - 4];
      b[m.from - 4] = 0;
    }
  }

  if ((m.piece & 7) === K) pos.king[us] = m.to;
  pos.castling &= CASTLE_MASK[m.from] & CASTLE_MASK[m.to];
  pos.ep = m.flag === 4 ? (m.from + m.to) >> 1 : -1;
  pos.half = (m.piece & 7) === P || m.cap ? 0 : pos.half + 1;
  if (us === BLACK) pos.full += 1;
  pos.side = us ^ 1;
}

export function unmakeMove(pos, m) {
  const undo = pos.stack.pop();
  const us = pos.side ^ 1;
  pos.side = us;
  const b = pos.board;

  b[m.from] = m.piece;
  if (m.flag === 1) {
    b[m.to] = 0;
    b[m.to + (us === WHITE ? -16 : 16)] = m.cap;
  } else {
    b[m.to] = m.cap;
  }

  if (m.flag === 2) {
    if (m.to === m.from + 2) {
      b[m.from + 3] = b[m.from + 1];
      b[m.from + 1] = 0;
    } else {
      b[m.from - 4] = b[m.from - 1];
      b[m.from - 1] = 0;
    }
  }

  if ((m.piece & 7) === K) pos.king[us] = m.from;
  pos.castling = undo.castling;
  pos.ep = undo.ep;
  pos.half = undo.half;
  if (us === BLACK) pos.full -= 1;
}

// Chaal legal ho toh khelta hai (true), warna wapas hata kar false deta hai
export function makeIfLegal(pos, m) {
  const mover = pos.side;
  makeMove(pos, m);
  if (isAttacked(pos, pos.king[mover], mover ^ 1)) {
    unmakeMove(pos, m);
    return false;
  }
  return true;
}

export function perft(pos, depth) {
  if (depth === 0) return 1;
  let nodes = 0;
  for (const m of genMoves(pos, false)) {
    if (!makeIfLegal(pos, m)) continue;
    nodes += perft(pos, depth - 1);
    unmakeMove(pos, m);
  }
  return nodes;
}

export const moveToUci = (m) => sqName(m.from) + sqName(m.to) + (m.promo ? "nbrq"[m.promo - 2] : "");

export function findMove(pos, uci) {
  const from = sqFromName(uci.slice(0, 2));
  const to = sqFromName(uci.slice(2, 4));
  const promo = uci[4] ? "nbrq".indexOf(uci[4]) + 2 : 0;
  return genMoves(pos, false).find((m) => m.from === from && m.to === to && m.promo === promo) || null;
}

/* ---------- Evaluation ---------- */

function evaluate(pos) {
  const b = pos.board;
  let score = 0;
  const bishops = [0, 0];
  let material = 0;

  for (let sq = 0; sq < 128; sq += 1) {
    if (sq & 0x88) {
      sq += 7;
      continue;
    }
    const p = b[sq];
    if (!p) continue;
    const t = p & 7;
    if (t !== P && t !== K) material += VALUE[t];
  }
  const endgame = material <= 2600;

  for (let sq = 0; sq < 128; sq += 1) {
    if (sq & 0x88) {
      sq += 7;
      continue;
    }
    const p = b[sq];
    if (!p) continue;
    const t = p & 7;
    const c = p >> 3;
    const file = sq & 7;
    const rank = sq >> 4;
    const idx = c === WHITE ? (7 - rank) * 8 + file : rank * 8 + file;

    let v = VALUE[t];
    if (t === K && endgame) {
      const centre = Math.max(Math.abs(file - 3.5), Math.abs(rank - 3.5));
      v += Math.round((3.5 - centre) * 12);
    } else {
      v += PST[t][idx];
    }
    if (t === B) bishops[c] += 1;
    score += c === WHITE ? v : -v;
  }

  if (bishops[WHITE] >= 2) score += 30;
  if (bishops[BLACK] >= 2) score -= 30;

  return pos.side === WHITE ? score : -score;
}

function orderMoves(moves) {
  for (const m of moves) {
    let s = 0;
    if (m.cap) s += 1000 + 10 * VALUE[m.cap & 7] - VALUE[m.piece & 7] / 10;
    if (m.promo) s += 800 + VALUE[m.promo];
    m.score = s;
  }
  moves.sort((a, b) => b.score - a.score);
}

/* ---------- Search ---------- */

function createSearcher(pos) {
  let nodes = 0;
  let deadline = 0;
  let timed = false;
  let stopped = false;

  function tick() {
    nodes += 1;
    if (timed && (nodes & 1023) === 0 && Date.now() > deadline) stopped = true;
  }

  function quiesce(alpha, beta, qd) {
    tick();
    if (stopped) return 0;
    const stand = evaluate(pos);
    if (stand >= beta) return beta;
    if (qd >= 6) return stand;
    if (alpha < stand) alpha = stand;

    const moves = genMoves(pos, true);
    orderMoves(moves);
    for (const m of moves) {
      if (!makeIfLegal(pos, m)) continue;
      const sc = -quiesce(-beta, -alpha, qd + 1);
      unmakeMove(pos, m);
      if (stopped) return 0;
      if (sc >= beta) return beta;
      if (sc > alpha) alpha = sc;
    }
    return alpha;
  }

  function search(depth, alpha, beta, ply) {
    tick();
    if (stopped) return 0;

    const checked = inCheck(pos);
    if (checked && ply < 10) depth += 1;
    if (depth <= 0) return quiesce(alpha, beta, 0);
    if (pos.half >= 100) return 0;

    const moves = genMoves(pos, false);
    orderMoves(moves);
    let legal = 0;

    for (const m of moves) {
      if (!makeIfLegal(pos, m)) continue;
      legal += 1;
      const sc = -search(depth - 1, -beta, -alpha, ply + 1);
      unmakeMove(pos, m);
      if (stopped) return 0;
      if (sc >= beta) return beta;
      if (sc > alpha) alpha = sc;
    }

    if (legal === 0) return checked ? -MATE + ply : 0;
    return alpha;
  }

  // Return: { depth, lines: [{ move, score }] } score side-to-move ke nazariye se, ya null (koi legal chaal nahi)
  function searchRoot(maxDepth, multipv, budgetMs) {
    nodes = 0;
    stopped = false;
    timed = false;
    deadline = Date.now() + budgetMs;

    const first = genMoves(pos, false);
    orderMoves(first);
    let entries = [];
    for (const m of first) {
      if (makeIfLegal(pos, m)) {
        unmakeMove(pos, m);
        entries.push({ m, score: 0 });
      }
    }
    if (!entries.length) return null;

    const keep = Math.min(multipv, entries.length);
    let completed = null;

    for (let depth = 1; depth <= maxDepth; depth += 1) {
      timed = depth > 1;
      const processed = [];
      let aborted = false;

      for (const entry of entries) {
        const a = processed.length >= keep ? processed[keep - 1].score : -INF;
        makeMove(pos, entry.m);
        const sc = -search(depth - 1, -INF, -a, 1);
        unmakeMove(pos, entry.m);
        if (stopped) {
          aborted = true;
          break;
        }
        const scored = { m: entry.m, score: sc <= a && processed.length >= keep ? a : sc };
        processed.push(scored);
        processed.sort((x, y) => y.score - x.score);
      }

      if (aborted) break;
      entries = processed;
      completed = { depth, lines: processed.slice(0, keep).map((e) => ({ move: e.m, score: e.score })) };
      if (completed.lines[0].score > MATE - 200 || completed.lines[0].score < -MATE + 200) break;
    }

    return completed;
  }

  return { searchRoot, getNodes: () => nodes };
}

/* ---------- UCI ---------- */

function uciScore(score) {
  if (Math.abs(score) > MATE - 200) {
    const plies = MATE - Math.abs(score);
    const moves = Math.max(1, Math.ceil(plies / 2));
    return `mate ${score > 0 ? moves : -moves}`;
  }
  return `cp ${score}`;
}

export function createEngine(send) {
  const pos = createPosition();
  setFen(pos, "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const options = { MultiPV: 1, "Skill Level": 20 };

  function setPosition(cmd) {
    const match = /^position\s+(startpos|fen\s+(.+?))(?:\s+moves\s+(.+))?\s*$/.exec(cmd);
    if (!match) return;
    setFen(pos, match[1] === "startpos" ? "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" : match[2]);
    if (match[3]) {
      for (const uci of match[3].split(/\s+/)) {
        const m = findMove(pos, uci);
        if (!m || !makeIfLegal(pos, m)) break;
      }
    }
  }

  function go(args) {
    const depthMatch = /depth (\d+)/.exec(args);
    const timeMatch = /movetime (\d+)/.exec(args);
    const skill = Number(options["Skill Level"]);
    const multipv = Math.max(1, Number(options.MultiPV) || 1);

    let maxDepth;
    let budget;
    if (timeMatch) {
      budget = Number(timeMatch[1]);
      maxDepth = skill >= 18 ? 6 : skill >= 12 ? 4 : skill >= 6 ? 3 : 2;
    } else {
      budget = multipv > 1 ? 1400 : 900;
      maxDepth = Math.min(Number(depthMatch ? depthMatch[1] : 4), 5);
    }

    const weak = Boolean(timeMatch) && skill < 18;
    const result = createSearcher(pos).searchRoot(maxDepth, weak ? Math.max(multipv, 5) : multipv, budget);

    if (!result) {
      send("info depth 0 score mate 0");
      send("bestmove (none)");
      return;
    }

    result.lines.slice(0, multipv).forEach((line, i) => {
      send(`info depth ${result.depth} multipv ${i + 1} score ${uciScore(line.score)} pv ${moveToUci(line.move)}`);
    });

    let pick = result.lines[0];
    if (weak && Math.abs(pick.score) < MATE - 200) {
      const tolerance = (20 - skill) * 12;
      const pool = result.lines.filter((l) => pick.score - l.score <= tolerance);
      pick = pool[Math.floor(Math.random() * pool.length)] || pick;
    }
    send(`bestmove ${moveToUci(pick.move)}`);
  }

  function handle(cmd) {
    const text = String(cmd).trim();
    if (text === "uci") {
      send("id name Qelvaris Basic Engine");
      send("uciok");
    } else if (text === "isready") {
      send("readyok");
    } else if (text.startsWith("setoption")) {
      const match = /name\s+(.+?)\s+value\s+(.+)$/.exec(text);
      if (match) options[match[1]] = match[2];
    } else if (text.startsWith("position")) {
      setPosition(text);
    } else if (text.startsWith("go")) {
      go(text);
    }
  }

  return { handle };
}
