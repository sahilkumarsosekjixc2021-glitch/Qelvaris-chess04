
import { useCallback, useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import { cancelEngine, getEngine, retainEngine } from "./engine2";
import { winChance } from "./chessUtils";

export const DEPTHS = [8, 10, 14];

const MULTIPV = 3;
const SHOW_PLIES = 8;

const cache = new Map();

/* UCI moves ko SAN mein convert karo */
function toMoves(fen, pv) {
  const chess = new Chess(fen);
  const out = [];

  for (const uci of pv.slice(0, SHOW_PLIES)) {
    try {
      const mv = chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci[4],
      });

      if (!mv) break;

      out.push({
        san: mv.san,
        uci,
        from: mv.from,
        to: mv.to,
      });
    } catch {
      break;
    }
  }

  return out;
}

function decorate(fen, line) {
  return {
    ...line,
    moves: toMoves(fen, line.pv),
  };
}

export function useExplore(baseFen, enabled) {
  const [depth, setDepth] = useState(10);
  const [lines, setLines] = useState([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);

  const [trailState, setTrailState] = useState({
    base: baseFen,
    moves: [],
  });

  const trail = trailState.base === baseFen
    ? trailState.moves
    : [];

  const setTrail = useCallback(
    (update) => {
      setTrailState((prev) => {
        const current =
          prev.base === baseFen ? prev.moves : [];

        return {
          base: baseFen,
          moves:
            typeof update === "function"
              ? update(current)
              : update,
        };
      });
    },
    [baseFen]
  );

  const fen = trail.length
    ? trail[trail.length - 1].fen
    : baseFen;

  /* Engine reference lifecycle */
  useEffect(() => {
    return retainEngine();
  }, []);

  /* Explore close hone par variation reset */
  useEffect(() => {
    if (enabled) return;

    setTrail([]);
    setSelected(null);
  }, [enabled, setTrail]);

  /* Engine analysis */
  useEffect(() => {
    if (!enabled || !fen) {
      setLines([]);
      setStatus("idle");
      return;
    }

    const key = `${fen}|${depth}`;

    if (cache.has(key)) {
      setLines(cache.get(key));
      setStatus("done");
      setError("");
      return;
    }

    let alive = true;
    let latest = [];

    setLines([]);
    setStatus("running");
    setError("");

    const timer = setTimeout(() => {
      getEngine()
        .analyse(fen, {
          depth,
          multipv: MULTIPV,

          onUpdate: (raw) => {
            if (!alive) return;

            latest = raw.map((line) =>
              decorate(fen, line)
            );

            setLines(latest);
          },
        })
        .then((finished) => {
          if (!alive || !finished) return;

          cache.set(key, latest);
          setStatus("done");
        })
        .catch((err) => {
          if (!alive) return;

          setStatus("error");
          setError(err.message || "Engine failed.");
        });
    }, 220);

    return () => {
      alive = false;
      clearTimeout(timer);
      cancelEngine();
    };
  }, [enabled, fen, depth]);

  /* Legal target squares */
  const targets = useMemo(() => {
    if (!selected || !fen) return [];

    try {
      return new Chess(fen)
        .moves({
          square: selected,
          verbose: true,
        })
        .map((m) => m.to);
    } catch {
      return [];
    }
  }, [selected, fen]);

  /* Board interaction */
  const squareClick = useCallback(
    (square) => {
      try {
        const chess = new Chess(fen);

        if (selected && targets.includes(square)) {
          const mv = chess.move({
            from: selected,
            to: square,
            promotion: "q",
          });

          if (!mv) return;

          setTrail((prev) => [
            ...prev,
            {
              san: mv.san,
              uci: mv.from + mv.to + (mv.promotion || ""),
              from: mv.from,
              to: mv.to,
              fen: chess.fen(),
            },
          ]);

          setSelected(null);
          return;
        }

        const piece = chess.get(square);

        if (
          piece &&
          piece.color === chess.turn() &&
          chess.moves({
            square,
            verbose: true,
          }).length
        ) {
          setSelected(square);
        } else {
          setSelected(null);
        }
      } catch (err) {
        console.error("Explore move failed:", err);
      }
    },
    [fen, selected, targets, setTrail]
  );

  /* Engine line play */
  const playLine = useCallback(
    (lineIndex, upto) => {
      const line = lines[lineIndex];

      if (!line) return;

      try {
        const chess = new Chess(fen);

        const added = line.moves
          .slice(0, upto + 1)
          .map((m) => {
            const mv = chess.move({
              from: m.from,
              to: m.to,
              promotion: m.uci[4],
            });

            return {
              san: mv.san,
              uci: m.uci,
              from: mv.from,
              to: mv.to,
              fen: chess.fen(),
            };
          });

        setTrail((prev) => [...prev, ...added]);
        setSelected(null);
      } catch (err) {
        console.error("Could not play line:", err);
      }
    },
    [fen, lines, setTrail]
  );

  /* UCI move play */
  const playUci = useCallback(
    (uci) => {
      try {
        const chess = new Chess(fen);

        const mv = chess.move({
          from: uci.slice(0, 2),
          to: uci.slice(2, 4),
          promotion: uci[4],
        });

        if (!mv) return;

        setTrail((prev) => [
          ...prev,
          {
            san: mv.san,
            uci,
            from: mv.from,
            to: mv.to,
            fen: chess.fen(),
          },
        ]);

        setSelected(null);
      } catch (err) {
        console.error("Could not play move:", err);
      }
    },
    [fen, setTrail]
  );

  const back = useCallback(() => {
    setTrail((prev) => prev.slice(0, -1));
    setSelected(null);
  }, [setTrail]);

  const reset = useCallback(() => {
    setTrail([]);
    setSelected(null);
  }, [setTrail]);

  const best = lines[0] || null;

  const last = trail.length
    ? trail[trail.length - 1]
    : null;

  const arrow =
    best && best.moves[0]
      ? {
          from: best.moves[0].from,
          to: best.moves[0].to,
        }
      : null;

  let whiteShare = null;

  if (trail.length && best) {
    const cp =
      best.mate !== null
        ? best.mate > 0
          ? 2000
          : -2000
        : Math.max(
            -2000,
            Math.min(2000, best.cp ?? 0)
          );

    whiteShare = winChance(cp);
  }

  return {
    active: enabled,
    baseFen,
    fen,
    trail,
    depth,
    setDepth,
    lines,
    status,
    error,
    arrow,
    lastMove: last
      ? { from: last.from, to: last.to }
      : null,
    whiteShare,
    selected,
    targets,
    squareClick,
    playLine,
    playUci,
    back,
    reset,
  };
}
