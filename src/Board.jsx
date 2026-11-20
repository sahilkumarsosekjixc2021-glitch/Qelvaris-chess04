
import { useEffect, useMemo, useRef, useState } from "react";
import "./Board.css";
import "./Board.a11y.css"; // QV-A11Y
import { playSound } from "./sound";

const FILES = "abcdefgh";

const PIECE_NAME = { k: "king", q: "queen", r: "rook", b: "bishop", n: "knight", p: "pawn" };

const GLYPH = {
  k: "♚",
  q: "♛",
  r: "♜",
  b: "♝",
  n: "♞",
  p: "♟",
};

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

function detectBoardSound(previousFen, currentFen) {
  if (!previousFen || !currentFen || previousFen === currentFen) return;

  const previous = parseFen(previousFen);
  const current = parseFen(currentFen);

  const previousMap = new Map(previous.map((piece) => [piece.sq, piece]));
  const currentMap = new Map(current.map((piece) => [piece.sq, piece]));

  // Castling
  for (const piece of previous) {
    if (piece.type !== "k") continue;

    const destination = current.find(
      (item) =>
        item.color === piece.color &&
        item.type === "k" &&
        Math.abs(
          FILES.indexOf(item.sq[0]) - FILES.indexOf(piece.sq[0])
        ) === 2
    );

    if (destination) {
      playSound("castle");
      return;
    }
  }

  // Promotion
  for (const [square, oldPiece] of previousMap) {
    const newPiece = currentMap.get(square);

    if (
      oldPiece.type === "p" &&
      newPiece &&
      newPiece.color === oldPiece.color &&
      newPiece.type !== "p"
    ) {
      playSound("promotion");
      return;
    }
  }

  // Capture
  if (current.length < previous.length) {
    playSound("capture");
    return;
  }

  playSound("move");
}

function Arrow({
  from,
  to,
  flipped,
  color,
  curve = 0,
  width = 16,
}) {
  const a = topLeft(from, flipped);
  const b = topLeft(to, flipped);

  const x1 = a.x + 50;
  const y1 = a.y + 50;
  const x2 = b.x + 50;
  const y2 = b.y + 50;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy) || 1;

  const cx = (x1 + x2) / 2 + (-dy / length) * curve;
  const cy = (y1 + y2) / 2 + (dx / length) * curve;

  let tx = x2 - cx;
  let ty = y2 - cy;
  const tl = Math.hypot(tx, ty) || 1;

  tx /= tl;
  ty /= tl;

  const k = width / 16;
  const headLength = 34 * k;
  const shaftEndX = x2 - tx * headLength;
  const shaftEndY = y2 - ty * headLength;
  const px = -ty * 26 * k;
  const py = tx * 26 * k;

  return (
    <g className="qb-arrow">
      <path
        d={`M${x1},${y1} Q${cx},${cy} ${shaftEndX},${shaftEndY}`}
        strokeWidth={width}
        strokeLinecap="round"
        style={color ? { stroke: color } : undefined}
      />
      <polygon
        points={`${x2 - tx * 6},${y2 - ty * 6} ${shaftEndX + px},${shaftEndY + py} ${shaftEndX - px},${shaftEndY - py}`}
        style={color ? { fill: color } : undefined}
      />
    </g>
  );
}

export default function Board({
  fen,
  flipped = false,
  lastMove = null,
  arrow = null,
  selected = null,
  targets = [],
  onSquareClick = null,
  showCoords = true,

  // Fog of War
  fog = false,
  visibleSquares = [],

  // Fog Chess selection glow
  glow = false,

  // Bit-Flip Chess
  glitch = [],
  arrows = [],
  ghosts = [],

  // BioCorruption
  infectionSquares = [],
  warningSquare = null,
  transformedSquares = [],
}) {
  const pieces = useMemo(() => parseFen(fen), [fen]);

  const occupied = useMemo(
    () => new Set(pieces.map((p) => p.sq)),
    [pieces]
  );

  const visibleSet = useMemo(
    () => new Set(visibleSquares),
    [visibleSquares]
  );

  const previousFenRef = useRef(null);

  // QV-A11Y: keyboard play. One square is tabbable; arrow keys move, Enter/Space selects.
  const hitRefs = useRef({});
  const [focusSq, setFocusSq] = useState(null);
  const [hasFocus, setHasFocus] = useState(false);
  const pieceAt = useMemo(() => new Map(pieces.map((p) => [p.sq, p])), [pieces]);
  const tabSq = focusSq || selected || (flipped ? "e7" : "e2");

  function squareLabel(sq) {
    const p = pieceAt.get(sq);
    const what = p ? `${p.color === "w" ? "white" : "black"} ${PIECE_NAME[p.type]}` : "empty";
    return `${sq}, ${what}${selected === sq ? ", selected" : ""}${targets.includes(sq) ? ", legal move" : ""}`;
  }

  function onSquareKey(e, sq) {
    const file = FILES.indexOf(sq[0]);
    const rank = Number(sq[1]);
    let c = flipped ? 7 - file : file;
    let r = flipped ? rank - 1 : 8 - rank;

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSquareClick?.(sq);
      return;
    }

    if (e.key === "ArrowUp") r -= 1;
    else if (e.key === "ArrowDown") r += 1;
    else if (e.key === "ArrowLeft") c -= 1;
    else if (e.key === "ArrowRight") c += 1;
    else if (e.key === "Home") c = 0;
    else if (e.key === "End") c = 7;
    else return;

    e.preventDefault();
    c = Math.max(0, Math.min(7, c));
    r = Math.max(0, Math.min(7, r));
    const nf = flipped ? 7 - c : c;
    const nr = flipped ? r + 1 : 8 - r;
    const next = FILES[nf] + nr;
    setFocusSq(next);
    hitRefs.current[next]?.focus();
  }

  useEffect(() => {
    const currentFen = String(fen || "");

    if (previousFenRef.current === null) {
      previousFenRef.current = currentFen;
      return;
    }

    detectBoardSound(previousFenRef.current, currentFen);
    previousFenRef.current = currentFen;
  }, [fen]);

  const squares = [];

  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const file = flipped ? 7 - c : c;
      const rank = flipped ? r + 1 : 8 - r;

      squares.push({
        sq: FILES[file] + rank,
        x: c * 100,
        y: r * 100,
        light: (file + rank) % 2 === 0,
        r,
        c,
      });
    }
  }

  const fogged = fog ? squares.filter((s) => !visibleSet.has(s.sq)) : [];
  const allArrows = [arrow, ...arrows].filter(Boolean);

  return (
    <div className={`qb-board ${fog ? "qb-board--fog" : ""}`}>
      <svg
        viewBox="0 0 800 800"
        role={onSquareClick ? "group" : "img"}
        aria-label={
          onSquareClick
            ? "Chess board. Use the arrow keys to move around and Enter to select a square."
            : "Chess board"
        }
      >
        <defs>
          <radialGradient id="qb-glow-grad">
            <stop offset="0%" stopColor="#e8862a" stopOpacity="0.38" />
            <stop offset="55%" stopColor="#e8862a" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#e8862a" stopOpacity="0" />
          </radialGradient>

          {fog && (
            <>
              <filter
                id="qb-smoke-filter"
                x="0"
                y="0"
                width="100%"
                height="100%"
              >
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency="0.007 0.011"
                  numOctaves="4"
                  seed="7"
                />
                <feColorMatrix
                  type="matrix"
                  values="0 0 0 0 0.66  0 0 0 0 0.82  0 0 0 0 0.74  0 0 0 1.7 -0.6"
                />
              </filter>

              <mask id="qb-fog-mask">
                {fogged.map((s) => (
                  <rect
                    key={`m-${s.sq}`}
                    x={s.x}
                    y={s.y}
                    width="100"
                    height="100"
                    fill="#fff"
                  />
                ))}
              </mask>
            </>
          )}
        </defs>

        {/* Board squares */}
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

        {/* Last move highlight */}
        {lastMove &&
          [lastMove.from, lastMove.to].map((sq) => {
            const p = topLeft(sq, flipped);

            return (
              <rect
                key={`last-${sq}`}
                x={p.x}
                y={p.y}
                width="100"
                height="100"
                fill="var(--board-highlight)"
              />
            );
          })}

        {/* BioCorruption infection zone */}
        {infectionSquares.map((sq) => {
          const p = topLeft(sq, flipped);

          return (
            <g
              key={`bio-infection-${sq}`}
              className="qb-bio-infection"
              pointerEvents="none"
            >
              <rect
                x={p.x + 3}
                y={p.y + 3}
                width="94"
                height="94"
                rx="12"
                className="qb-bio-infection-fill"
              />
              <rect
                x={p.x + 5}
                y={p.y + 5}
                width="90"
                height="90"
                rx="10"
                className="qb-bio-infection-border"
              />
            </g>
          );
        })}

        {/* BioCorruption warning */}
        {warningSquare &&
          (() => {
            const p = topLeft(warningSquare, flipped);

            return (
              <g className="qb-bio-warning" pointerEvents="none">
                <rect
                  x={p.x + 4}
                  y={p.y + 4}
                  width="92"
                  height="92"
                  rx="12"
                  className="qb-bio-warning-fill"
                />
                <rect
                  x={p.x + 8}
                  y={p.y + 8}
                  width="84"
                  height="84"
                  rx="10"
                  className="qb-bio-warning-ring"
                />
                <circle
                  cx={p.x + 50}
                  cy={p.y + 50}
                  r="8"
                  className="qb-bio-warning-core"
                />
              </g>
            );
          })()}

        {/* Selected square */}
        {selected &&
          (() => {
            const p = topLeft(selected, flipped);

            return (
              <rect
                x={p.x}
                y={p.y}
                width="100"
                height="100"
                fill={
                  glow
                    ? "rgba(232, 134, 42, 0.32)"
                    : "rgba(78, 204, 163, 0.45)"
                }
              />
            );
          })()}

        {/* Coordinates */}
        {showCoords &&
          squares.map((s) => {
            const color = s.light
              ? "var(--board-dark)"
              : "var(--board-light)";

            return (
              <g key={`coord-${s.sq}`}>
                {s.c === 0 && (
                  <text
                    className="qb-coord"
                    x={s.x + 6}
                    y={s.y + 24}
                    fill={color}
                  >
                    {s.sq[1]}
                  </text>
                )}

                {s.r === 7 && (
                  <text
                    className="qb-coord"
                    x={s.x + 76}
                    y={s.y + 92}
                    fill={color}
                  >
                    {s.sq[0]}
                  </text>
                )}
              </g>
            );
          })}

        {/* Move targets */}
        {targets.map((sq) => {
          const p = topLeft(sq, flipped);

          return occupied.has(sq) ? (
            <circle
              key={`t-${sq}`}
              cx={p.x + 50}
              cy={p.y + 50}
              r="46"
              fill="none"
              stroke="rgba(0,0,0,0.3)"
              strokeWidth="9"
            />
          ) : (
            <circle
              key={`t-${sq}`}
              cx={p.x + 50}
              cy={p.y + 50}
              r="15"
              fill="rgba(0,0,0,0.28)"
            />
          );
        })}

        {/* Pieces */}
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
              {"︎"}
            </text>
          );
        })}

        {/* Ghost pieces - Bit-Flip */}
        {ghosts.map((g) => {
          const p = topLeft(g.sq, flipped);

          return (
            <text
              key={`ghost-${g.sq}`}
              className={`qb-piece qb-piece--${g.color} qb-ghost`}
              x={p.x + 50}
              y={p.y + 54}
              fontSize="84"
              textAnchor="middle"
              dominantBaseline="central"
            >
              {GLYPH[g.type]}
              {"︎"}
            </text>
          );
        })}

        {/* BioCorruption transformation aura */}
        {transformedSquares.map((sq) => {
          const p = topLeft(sq, flipped);

          return (
            <g
              key={`bio-transform-${sq}`}
              className="qb-bio-transform"
              pointerEvents="none"
            >
              <circle
                cx={p.x + 50}
                cy={p.y + 50}
                r="44"
                className="qb-bio-transform-aura"
              />
              <circle
                cx={p.x + 50}
                cy={p.y + 50}
                r="35"
                className="qb-bio-transform-ring"
              />
              <circle
                cx={p.x + 50}
                cy={p.y + 50}
                r="27"
                className="qb-bio-transform-flash"
              />
            </g>
          );
        })}

        {/* Fog overlay */}
        {fog && (
          <g className="qb-fog" pointerEvents="none">
            {fogged.map((s) => (
              <rect
                key={`fog-${s.sq}`}
                className={`qb-fog-square ${
                  s.light ? "qb-fog--light" : "qb-fog--dark"
                }`}
                x={s.x}
                y={s.y}
                width="100"
                height="100"
              />
            ))}

            <g mask="url(#qb-fog-mask)">
              <rect
                className="qb-smoke"
                x="0"
                y="0"
                width="800"
                height="800"
                filter="url(#qb-smoke-filter)"
              />
            </g>
          </g>
        )}

        {/* Glow ring around selected piece */}
        {glow &&
          selected &&
          (() => {
            const p = topLeft(selected, flipped);
            const cx = p.x + 50;
            const cy = p.y + 50;

            return (
              <g className="qb-ring" pointerEvents="none">
                <circle
                  cx={cx}
                  cy={cy}
                  r="150"
                  fill="url(#qb-glow-grad)"
                />
                <circle
                  cx={cx}
                  cy={cy}
                  r="135"
                  fill="none"
                  stroke="rgba(232,134,42,0.85)"
                  strokeWidth="3"
                />
                <circle
                  cx={cx}
                  cy={cy}
                  r="62"
                  fill="none"
                  stroke="rgba(232,134,42,0.9)"
                  strokeWidth="4"
                />
              </g>
            );
          })()}

        {/* Glitch rings - Bit-Flip */}
        {glitch.map((sq) => {
          const p = topLeft(sq, flipped);

          return (
            <g
              key={`gl-${sq}`}
              className="qb-glitch"
              pointerEvents="none"
            >
              <circle
                cx={p.x + 50}
                cy={p.y + 50}
                r="60"
                fill="none"
                stroke="#f5b83a"
                strokeWidth="5"
              />
              <circle
                cx={p.x + 50}
                cy={p.y + 50}
                r="74"
                fill="none"
                stroke="#f5b83a"
                strokeWidth="2"
                opacity="0.45"
              />
            </g>
          );
        })}

        {/* Arrows */}
        {allArrows.map((a, i) => (
          <Arrow
            key={`arrow-${i}-${a.from}-${a.to}`}
            from={a.from}
            to={a.to}
            flipped={flipped}
            color={a.color}
            curve={a.curve}
            width={a.width}
          />
        ))}

        {/* Click handling */}
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
              ref={(el) => { hitRefs.current[s.sq] = el; }}
              role="button"
              tabIndex={s.sq === tabSq ? 0 : -1}
              aria-label={squareLabel(s.sq)}
              onKeyDown={(e) => onSquareKey(e, s.sq)}
              onFocus={() => { setFocusSq(s.sq); setHasFocus(true); }}
              onBlur={() => setHasFocus(false)}
            />
          ))}

        {/* Keyboard focus ring */}
        {onSquareClick && hasFocus && focusSq &&
          (() => {
            const p = topLeft(focusSq, flipped);
            return (
              <rect
                x={p.x + 4}
                y={p.y + 4}
                width="92"
                height="92"
                rx="8"
                fill="none"
                stroke="#f7b538"
                strokeWidth="7"
                pointerEvents="none"
              />
            );
          })()}
      </svg>
    </div>
  );
}
