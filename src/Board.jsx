import { useMemo } from "react";
import "./Board.css";

const FILES = "abcdefgh";
const GLYPH = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };

// FEN se pieces ki list nikalta hai (chess.js ki zaroorat nahi)
export function parseFen(fen) {
  const pieces = [];
  const rows = String(fen || "").split(" ")[0].split("/");

  rows.forEach((row, r) => {
    let file = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) {
        file += Number(ch);
      } else {
        pieces.push({
          sq: FILES[file] + (8 - r),
          type: ch.toLowerCase(),
          color: ch === ch.toUpperCase() ? "w" : "b",
        });
        file += 1;
      }
    }
  });

  return pieces;
}

function topLeft(sq, flipped) {
  const file = FILES.indexOf(sq[0]);
  const rank = Number(sq[1]);
  return {
    x: (flipped ? 7 - file : file) * 100,
    y: (flipped ? rank - 1 : 8 - rank) * 100,
  };
}

function Arrow({ from, to, flipped }) {
  const a = topLeft(from, flipped);
  const b = topLeft(to, flipped);
  const x1 = a.x + 50;
  const y1 = a.y + 50;
  const x2 = b.x + 50;
  const y2 = b.y + 50;

  const length = Math.hypot(x2 - x1, y2 - y1) || 1;
  const ux = (x2 - x1) / length;
  const uy = (y2 - y1) / length;
  const headLength = 34;
  const shaftEndX = x2 - ux * headLength;
  const shaftEndY = y2 - uy * headLength;
  const px = -uy * 26;
  const py = ux * 26;

  return (
    <g className="qb-arrow">
      <line x1={x1} y1={y1} x2={shaftEndX} y2={shaftEndY} strokeWidth="16" strokeLinecap="round" />
      <polygon
        points={`${x2 - ux * 6},${y2 - uy * 6} ${shaftEndX + px},${shaftEndY + py} ${shaftEndX - px},${shaftEndY - py}`}
      />
    </g>
  );
}

/*
  Props:
    fen, flipped, lastMove {from,to}, arrow {from,to}, showCoords
    selected: square, targets: [squares], onSquareClick(square)  (Play aur Train pages ke liye)
*/
export default function Board({
  fen,
  flipped = false,
  lastMove = null,
  arrow = null,
  selected = null,
  targets = [],
  onSquareClick = null,
  showCoords = true,
}) {
  const pieces = useMemo(() => parseFen(fen), [fen]);
  const occupied = useMemo(() => new Set(pieces.map((p) => p.sq)), [pieces]);

  const squares = [];
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const file = flipped ? 7 - c : c;
      const rank = flipped ? r + 1 : 8 - r;
      squares.push({ sq: FILES[file] + rank, x: c * 100, y: r * 100, light: (file + rank) % 2 === 0, r, c });
    }
  }

  return (
    <div className="qb-board">
      <svg viewBox="0 0 800 800" role="img" aria-label="Chess board">
        {squares.map((s) => (
          <rect
            key={s.sq}
            x={s.x}
            y={s.y}
            width="100"
            height="100"
            fill={s.light ? "var(--board-light)" : "var(--board-dark)"}
          />
        ))}

        {lastMove &&
          [lastMove.from, lastMove.to].map((sq) => {
            const p = topLeft(sq, flipped);
            return <rect key={`last-${sq}`} x={p.x} y={p.y} width="100" height="100" fill="var(--board-highlight)" />;
          })}

        {selected && (() => {
          const p = topLeft(selected, flipped);
          return <rect x={p.x} y={p.y} width="100" height="100" fill="rgba(78, 204, 163, 0.45)" />;
        })()}

        {showCoords &&
          squares.map((s) => {
            const color = s.light ? "var(--board-dark)" : "var(--board-light)";
            return (
              <g key={`coord-${s.sq}`}>
                {s.c === 0 && (
                  <text className="qb-coord" x={s.x + 6} y={s.y + 24} fill={color}>
                    {s.sq[1]}
                  </text>
                )}
                {s.r === 7 && (
                  <text className="qb-coord" x={s.x + 76} y={s.y + 92} fill={color}>
                    {s.sq[0]}
                  </text>
                )}
              </g>
            );
          })}

        {targets.map((sq) => {
          const p = topLeft(sq, flipped);
          return occupied.has(sq) ? (
            <circle key={`t-${sq}`} cx={p.x + 50} cy={p.y + 50} r="46" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="9" />
          ) : (
            <circle key={`t-${sq}`} cx={p.x + 50} cy={p.y + 50} r="15" fill="rgba(0,0,0,0.28)" />
          );
        })}

        {pieces.map((piece) => {
          const p = topLeft(piece.sq, flipped);
          return (
            <text
              key={piece.sq}
              className={`qb-piece qb-piece--${piece.color}`}
              x={p.x + 50}
              y={p.y + 54}
              fontSize="84"
              textAnchor="middle"
              dominantBaseline="central"
            >
              {GLYPH[piece.type]}
              {"\uFE0E"}
            </text>
          );
        })}

        {arrow && <Arrow from={arrow.from} to={arrow.to} flipped={flipped} />}

        {onSquareClick &&
          squares.map((s) => (
            <rect
              key={`hit-${s.sq}`}
              className="qb-hit"
              x={s.x}
              y={s.y}
              width="100"
              height="100"
              fill="transparent"
              onClick={() => onSquareClick(s.sq)}
            />
          ))}
      </svg>
    </div>
  );
}