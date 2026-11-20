import { useEffect, useReducer, useRef, useState } from "react";
import { ECHO_CONFIG } from "./echoConfig";
import { applyMove, createGame, footprintStage, getStatus, getVisiblePieces, hintsFor, makeFootprint, randomMove } from "./echoEngine";
import { playEchoSound, playRejected } from "./echoSound";

/*
 * Connects the pure engine to React. Holds ONLY what the player is allowed to know:
 * own pieces, footprints, echo log. The hidden board lives inside the engine object.
 */
export default function useEchoTrace({ playerColor = "w", mode = "bot", config = ECHO_CONFIG, network = null } = {}) {
  const gameRef = useRef(null);
  if (!gameRef.current) gameRef.current = createGame();
  const game = gameRef.current;

  const [version, bump] = useReducer((x) => x + 1, 0);
  const [selected, setSelected] = useState(null);
  const [hints, setHints] = useState([]);
  const [footprints, setFootprints] = useState([]);
  const [log, setLog] = useState([]);
  const [captured, setCaptured] = useState({ mine: [], lost: [] });
  const [message, setMessage] = useState("");
  const [echo, setEcho] = useState(null);
  const [lastOwn, setLastOwn] = useState(null);
  const [soundOn, setSoundOn] = useState(true);
  const soundRef = useRef(true);
  soundRef.current = soundOn;

  const opponent = playerColor === "w" ? "b" : "w";
  const status = getStatus(game, playerColor);
  const turn = game.chess.turn();

  /* Handles any accepted move, yours or the opponent's. */
  const commit = (mv) => {
    const mine = mv.color === playerColor;
    if (mv.captured) setCaptured((c) => (mine ? { ...c, mine: [...c.mine, mv.captured] } : { ...c, lost: [...c.lost, mv.captured] }));
    if (mine) {
      setLog((l) => [...l, { side: "you", san: mv.san, piece: mv.piece }]);
      setLastOwn({ from: mv.from, to: mv.to });
    } else {
      const fp = makeFootprint(mv, game.ply, config);
      setFootprints((f) => [...f.filter((x) => footprintStage(x, game.ply, config)), fp]);
      setLog((l) => [...l, { side: "echo", piece: mv.piece, capture: !!mv.captured }]);
      setEcho({ piece: mv.piece, id: Date.now() });
      playEchoSound(mv.piece, soundRef.current);
    }
    let msg = "";
    if (config.announceCheck && game.chess.isCheck() && !game.chess.isCheckmate())
      msg = game.chess.turn() === playerColor ? config.messages.yourCheck : config.messages.theirCheck;
    setMessage(msg);
    setSelected(null);
    setHints([]);
    bump();
  };

  const onSquareClick = (sq) => {
    if (status.over || game.chess.turn() !== playerColor) return;
    if (selected && hints.some((h) => h.sq === sq)) {
      const res = applyMove(game, { from: selected, to: sq, promotion: config.autoPromote });
      if (!res.ok) {
        playRejected(soundRef.current);
        setMessage(config.messages.rejected);
        setSelected(null);
        setHints([]);
        return;
      }
      commit(res.move);
      if (mode === "online" && network) network.sendMove({ from: selected, to: sq, promotion: config.autoPromote });
      return;
    }
    const p = game.chess.get(sq);
    if (p && p.color === playerColor) {
      setSelected(sq);
      setHints(hintsFor(game, playerColor, sq, config));
      setMessage("");
    } else {
      setSelected(null);
      setHints([]);
    }
  };

  /* Practice opponent (placeholder, not real multiplayer). */
  useEffect(() => {
    if (mode !== "bot" || status.over || game.chess.turn() !== opponent) return undefined;
    const t = setTimeout(() => {
      const m = randomMove(game);
      if (!m) return;
      const r = applyMove(game, { from: m.from, to: m.to, promotion: "q" });
      if (r.ok) commit(r.move);
    }, 700 + Math.random() * 600);
    return () => clearTimeout(t);
  }, [version]); // eslint-disable-line

  /* Real multiplayer hook-up point: opponent moves arrive from echoNetwork. */
  useEffect(() => {
    if (mode !== "online" || !network) return undefined;
    return network.onOpponentMove((m) => {
      const r = applyMove(game, m);
      if (r.ok) commit(r.move);
    });
  }, [mode, network]); // eslint-disable-line

  const newGame = () => {
    gameRef.current = createGame();
    setSelected(null);
    setHints([]);
    setFootprints([]);
    setLog([]);
    setCaptured({ mine: [], lost: [] });
    setMessage("");
    setEcho(null);
    setLastOwn(null);
    bump();
  };

  return {
    pieces: getVisiblePieces(game, playerColor, config, status.over),
    footprints,
    currentPly: game.ply,
    selected,
    hints,
    lastOwn,
    log,
    captured,
    message,
    echo,
    status,
    soundOn,
    setSoundOn,
    isMyTurn: turn === playerColor && !status.over,
    flipped: playerColor === "b",
    onSquareClick,
    newGame,
  };
}