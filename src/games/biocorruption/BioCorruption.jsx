import { useEffect, useRef, useState } from "react";
import { askConfirm } from "../../lib/confirm";

import {
  createInitialBoard,
  getMoves,
  applyMove,
} from "../fog-of-war/fogEngine.js";
import BioBoard from "../../BioBoard.jsx";
import { Chess } from "chess.js";

import { chooseBioMove } from "./bioAI.js";

import {
  MOVES_PER_CYCLE,
  DEFENSE_MOVES,
  PLAYERS,
  boardToFen,
  getKingSquare,
  getMaterialCount,
  chooseWarningSquare,
  transformPieces,
  panicMoves,
} from "./bioEngine";

import "../fog-of-war/FogOfWar.css";
import "./BioCorruption.css";

const initialCastling = {
  wK: true,
  wQ: true,
  bK: true,
  bQ: true,
};

const opposite = (color) => (color === "w" ? "b" : "w");

// Pre-match: time controls (seconds + increment)
const TIME_OPTIONS = [
  { id: "1m", label: "1 min", seconds: 60, inc: 0 },
  { id: "3+2", label: "3+2", seconds: 180, inc: 2 },
  { id: "5m", label: "5 min", seconds: 300, inc: 0 },
  { id: "10m", label: "10 min", seconds: 600, inc: 0 },
  { id: "15+10", label: "15+10", seconds: 900, inc: 10 },
  { id: "inf", label: "No limit", seconds: Infinity, inc: 0 },
];

// Pre-match: AI difficulty (1-5)
const AI_LEVELS = [
  { name: "Beginner", hint: "Random legal moves. Easy to beat." },
  { name: "Easy", hint: "Sees 1 move ahead and still blunders." },
  { name: "Medium", hint: "Thinks 2 moves ahead and tracks the infection." },
  { name: "Hard", hint: "Thinks 3 moves ahead and plans around infection zones." },
  { name: "Master", hint: "Deep search. Rarely makes a mistake." },
];

const PIECE_NAMES = { p: "", n: "N", b: "B", r: "R", q: "Q", k: "K" };

const FILES = "abcdefgh";

// Small infection: the warning square + 3 neighbours (a 2x2 block).
// The block always stays on the board and its direction is random.
function createSmallInfectionZone(square) {
  if (!square) return [];

  const file = FILES.indexOf(square[0]);
  const rank = Number(square.slice(1));

  const fileSteps = [];
  if (file < 7) fileSteps.push(1);
  if (file > 0) fileSteps.push(-1);

  const rankSteps = [];
  if (rank < 8) rankSteps.push(1);
  if (rank > 1) rankSteps.push(-1);

  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const df = pick(fileSteps);
  const dr = pick(rankSteps);

  return [
    square,
    `${FILES[file + df]}${rank}`,
    `${FILES[file]}${rank + dr}`,
    `${FILES[file + df]}${rank + dr}`,
  ];
}

function createChessPosition(board, turn, enPassant, castling) {
  const rows = [];

  for (let rank = 8; rank >= 1; rank--) {
    let row = "";
    let empty = 0;

    for (let file = 0; file < 8; file++) {
      const square = "abcdefgh"[file] + rank;
      const piece = board[square];

      if (!piece) {
        empty++;
        continue;
      }

      if (empty) {
        row += empty;
        empty = 0;
      }

      row +=
        piece.color === "w"
          ? piece.type.toUpperCase()
          : piece.type;
    }

    if (empty) row += empty;
    rows.push(row);
  }

  const rights =
    (castling.wK ? "K" : "") +
    (castling.wQ ? "Q" : "") +
    (castling.bK ? "k" : "") +
    (castling.bQ ? "q" : "");

  const fen = `${rows.join("/")} ${turn} ${
    rights || "-"
  } ${enPassant || "-"} 0 1`;

  return new Chess(fen, { skipValidation: true });
}

function getAvailableMoves(
  board,
  from,
  color,
  enPassant,
  castling,
  corrupted
) {
  const piece = board[from];

  if (!piece || piece.color !== color) return [];

  const kingSquare = getKingSquare(board, color);

  const restrictedKingMoves = panicMoves(
    board,
    color,
    corrupted,
    getMoves,
    enPassant,
    castling
  );

  if (restrictedKingMoves !== null && from !== kingSquare) {
    return [];
  }

  try {
    const chess = createChessPosition(
      board,
      color,
      enPassant,
      castling
    );

    let moves = chess.moves({
      square: from,
      verbose: true,
    });

    if (restrictedKingMoves !== null && from === kingSquare) {
      moves = moves.filter((move) =>
        restrictedKingMoves.includes(move.to)
      );
    }

    return moves.map((move) => move.to);
  } catch (error) {
    console.error("BioCorruption move validation:", error);
    return [];
  }
}

function getRandomMove(
  board,
  color,
  enPassant,
  castling,
  corrupted
) {
  const candidates = [];

  for (const [from, piece] of Object.entries(board)) {
    if (piece?.color !== color) continue;

    const moves = getAvailableMoves(
      board,
      from,
      color,
      enPassant,
      castling,
      corrupted
    );

    moves.forEach((to) => {
      candidates.push({ from, to });
    });
  }

  if (!candidates.length) return null;

  return candidates[
    Math.floor(Math.random() * candidates.length)
  ];
}

// AI search runs in a Web Worker so the page never freezes while it thinks.
function createBioAiRunner() {
  let worker = null;

  const fallback = (state, level) => {
    try {
      return chooseBioMove(state, level);
    } catch {
      return null;
    }
  };

  return {
    ask(state, level) {
      return new Promise((resolve) => {
        if (typeof Worker === "undefined") {
          setTimeout(() => resolve(fallback(state, level)), 0);
          return;
        }

        let w;

        try {
          w = new Worker(new URL("./bioAI.worker.js", import.meta.url), {
            type: "module",
          });
        } catch {
          setTimeout(() => resolve(fallback(state, level)), 0);
          return;
        }

        worker = w;

        const done = (move) => {
          resolve(move ?? null);
          w.terminate();
          if (worker === w) worker = null;
        };

        w.onmessage = (event) => done(event.data.move);
        w.onerror = () => done(null);
        w.postMessage({ state, level });
      });
    },

    cancel() {
      if (worker) {
        worker.terminate();
        worker = null;
      }
    },
  };
}

function createSnapshot(state) {
  return {
    board: { ...state.board },
    turn: state.turn,
    corrupted: [...state.corrupted],
    plies: state.plies,
    time: { ...state.time },
    enPassant: state.enPassant,
    castling: { ...state.castling },
    lastMove: state.lastMove,
    winner: state.winner,
    winReason: state.winReason,
    cyclePhase: state.cyclePhase,
    cycleMoves: state.cycleMoves,
    warningSquare: state.warningSquare,
    defenseMovesLeft: state.defenseMovesLeft,
    cycleNumber: state.cycleNumber,
    lastTransformation: state.lastTransformation,
    moveLog: [...state.moveLog],
    convertedTotal: state.convertedTotal,
    elapsed: state.elapsed,
  };
}

export default function BioCorruption({ onBack }) {
  const [screen, setScreen] = useState("setup");
  const [playerColor, setPlayerColor] = useState("w");
  const [selectedSide, setSelectedSide] = useState("w");
  const [gameMode, setGameMode] = useState("ai");
  const [aiLevel, setAiLevel] = useState(3);
  const [timeId, setTimeId] = useState("5m");
  const timeOption =
    TIME_OPTIONS.find((item) => item.id === timeId) || TIME_OPTIONS[2];

  const [elapsed, setElapsed] = useState(0);
  const [convertedTotal, setConvertedTotal] = useState(0);
  const [moveLog, setMoveLog] = useState([]);
  const [swapColors, setSwapColors] = useState(false);
  const [copyState, setCopyState] = useState("");
  const [notice, setNotice] = useState("");

  const [board, setBoard] = useState(() => createInitialBoard());
  const [turn, setTurn] = useState("w");
  const [selected, setSelected] = useState(null);
  const [targets, setTargets] = useState([]);
  const [lastMove, setLastMove] = useState(null);

  const [corrupted, setCorrupted] = useState([]);
  const [plies, setPlies] = useState(0);

  const [cyclePhase, setCyclePhase] = useState("countdown");
  const [cycleMoves, setCycleMoves] = useState(0);
  const [warningSquare, setWarningSquare] = useState(null);
  const [defenseMovesLeft, setDefenseMovesLeft] = useState(0);
  const [cycleNumber, setCycleNumber] = useState(1);
  const [lastTransformation, setLastTransformation] = useState([]);

  const [winner, setWinner] = useState(null);
  const [winReason, setWinReason] = useState("");
  const [resultOpen, setResultOpen] = useState(false);

  const [time, setTime] = useState({
    w: 300,
    b: 300,
  });

  const [enPassant, setEnPassant] = useState(null);
  const [castling, setCastling] = useState(initialCastling);
  const [history, setHistory] = useState([]);

  const [drawOffer, setDrawOffer] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState([]);

  const aiTimer = useRef(null);
  const aiRunner = useRef(null);
  if (!aiRunner.current) aiRunner.current = createBioAiRunner();

  const currentPlayerName = PLAYERS[turn];

  function startGame(forcedSide) {
    // Online play needs a realtime server connection; do not start a fake local game.
    if (gameMode === "online") return;

    // Buttons pass a click event; only a "w"/"b" string forces a side.
    const pick =
      forcedSide === "w" || forcedSide === "b"
        ? forcedSide
        : selectedSide;
    const side =
      pick === "r" ? (Math.random() < 0.5 ? "w" : "b") : pick;

    setPlayerColor(side);

    if (aiTimer.current) {
      clearTimeout(aiTimer.current);
      aiTimer.current = null;
    }

    setBoard(createInitialBoard());
    setTurn("w");
    setSelected(null);
    setTargets([]);
    setLastMove(null);

    setCorrupted([]);
    setPlies(0);

    setCyclePhase("countdown");
    setCycleMoves(0);
    setWarningSquare(null);
    setDefenseMovesLeft(0);
    setCycleNumber(1);
    setLastTransformation([]);

    setWinner(null);
    setWinReason("");

    setTime({
      w: timeOption.seconds,
      b: timeOption.seconds,
    });

    setElapsed(0);
    setConvertedTotal(0);
    setMoveLog([]);
    setCopyState("");
    setNotice("");

    setEnPassant(null);
    setCastling({ ...initialCastling });
    setHistory([]);

    setDrawOffer(null);
    setMessages([]);
    setChatOpen(false);
    setChatInput("");

    setScreen("game");
  }

  async function backToGameModes() {
    if (!winner) {
      const leave = await askConfirm(
        "Leave this match and return to Game Modes?"
      );
      if (!leave) return;
    }

    if (aiTimer.current) {
      clearTimeout(aiTimer.current);
      aiTimer.current = null;
    }

    setSelected(null);
    setTargets([]);
    setDrawOffer(null);
    setChatOpen(false);

    if (onBack) {
      onBack();
    } else {
      setScreen("setup");
    }
  }

  function newGame() {
    setSelected(null);
    setTargets([]);
    setDrawOffer(null);
    setChatOpen(false);
    setResultOpen(false);
    setScreen("setup");
  }

  function goHome() {
    if (onBack) onBack();
    else newGame();
  }

  function rematch() {
    startGame(swapColors ? opposite(playerColor) : playerColor);
  }

  async function copyLog() {
    const text = [
      `BioCorruption · ${PLAYERS.w} vs ${PLAYERS.b}`,
      `Result: ${
        winner === "draw"
          ? "Draw"
          : winner
            ? `${PLAYERS[winner]} wins`
            : "In progress"
      }${winReason ? ` (${winReason})` : ""}`,
      "",
      ...moveLog,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
    } catch {
      // Fallback for browsers that block the clipboard API
      try {
        const area = document.createElement("textarea");
        area.value = text;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(area);
        setCopyState(ok ? "copied" : "failed");
      } catch {
        setCopyState("failed");
      }
    }

    setTimeout(() => setCopyState(""), 2000);
  }

  function finishGame(result, reason) {
    setWinner(result);
    setWinReason(reason);
    setSelected(null);
    setTargets([]);
    setDrawOffer(null);

    if (aiTimer.current) {
      clearTimeout(aiTimer.current);
      aiTimer.current = null;
    }
  }

  function makeTurn(from, to) {
    if (winner || screen !== "game" || !board[from]) return;

    const movingPiece = board[from];

    if (movingPiece.color !== turn) return;

    const legalMoves = getAvailableMoves(
      board,
      from,
      turn,
      enPassant,
      castling,
      corrupted
    );

    if (!legalMoves.includes(to)) return;

    const previous = createSnapshot({
      board,
      turn,
      corrupted,
      plies,
      time,
      enPassant,
      castling,
      lastMove,
      winner,
      winReason,
      cyclePhase,
      cycleMoves,
      warningSquare,
      defenseMovesLeft,
      cycleNumber,
      lastTransformation,
      moveLog,
      convertedTotal,
      elapsed,
    });

    const moveResult = applyMove(
      board,
      from,
      to,
      enPassant,
      castling,
      "q"
    );

    if (!moveResult?.board) return;

    let nextBoard = moveResult.board;
    let nextCorrupted = [...corrupted];

    let nextPhase = cyclePhase;
    let nextCycleMoves = cycleMoves;
    let nextWarningSquare = warningSquare;
    let nextDefenseMoves = defenseMovesLeft;
    let nextCycleNumber = cycleNumber;
    let nextTransformation = [];

    const nextTurn = opposite(turn);
    const nextPlies = plies + 1;

    // PHASE 1: Warning countdown
    if (cyclePhase === "countdown") {
      nextCycleMoves = cycleMoves + 1;

      if (nextCycleMoves >= MOVES_PER_CYCLE) {
        nextPhase = "warning";
        nextWarningSquare = chooseWarningSquare(nextBoard);
        nextCycleMoves = 0;
      }
    }

    // PHASE 2: Activate infection
    else if (cyclePhase === "warning") {
      nextCorrupted = createSmallInfectionZone(warningSquare);
      nextPhase = "defense";
      nextDefenseMoves = DEFENSE_MOVES;
      nextWarningSquare = null;
    }

    // PHASE 3: Defense and transformation
    else if (cyclePhase === "defense") {
      nextDefenseMoves = Math.max(0, defenseMovesLeft - 1);

      if (nextDefenseMoves === 0) {
        const result = transformPieces(
          nextBoard,
          nextCorrupted
        );

        nextBoard = result.board;
        nextTransformation = result.transformed;

        nextCorrupted = [];
        nextPhase = "countdown";
        nextCycleMoves = 0;
        nextWarningSquare = null;
        nextCycleNumber = cycleNumber + 1;
      }
    }

    // move log + converted counter + increment
    const letter = PIECE_NAMES[movingPiece.type] || "";
    const logLines = [
      `${Math.floor(plies / 2) + 1}${turn === "w" ? "." : "..."} ${
        PLAYERS[turn]} ${letter}${from}${board[to] ? "x" : "-"}${to}`,
    ];

    if (nextTransformation.length) {
      logLines.push(
        `☣ Cycle ${cycleNumber}: ${nextTransformation.length} piece(s) changed team`
      );
    }

    setMoveLog((old) => [...old, ...logLines]);
    setConvertedTotal((old) => old + nextTransformation.length);

    if (timeOption.inc && Number.isFinite(time[turn])) {
      setTime((old) => ({
        ...old,
        [turn]: old[turn] + timeOption.inc,
      }));
    }

    setHistory((old) => [...old, previous]);

    setBoard(nextBoard);
    setTurn(nextTurn);
    setLastMove({ from, to });
    setSelected(null);
    setTargets([]);
    setPlies(nextPlies);

    setEnPassant(moveResult.enPassant ?? null);
    setCastling(moveResult.castling ?? castling);

    setCorrupted(nextCorrupted);

    setCyclePhase(nextPhase);
    setCycleMoves(nextCycleMoves);
    setWarningSquare(nextWarningSquare);
    setDefenseMovesLeft(nextDefenseMoves);
    setCycleNumber(nextCycleNumber);
    setLastTransformation(nextTransformation);

    // Standard chess terminal-position validation
    try {
      const position = createChessPosition(
        nextBoard,
        nextTurn,
        moveResult.enPassant ?? null,
        moveResult.castling ?? castling
      );

      if (position.isCheckmate()) {
        finishGame(
          turn,
          `${PLAYERS[nextTurn]} is checkmated.`
        );
        return;
      }

      if (position.isStalemate()) {
        finishGame("draw", "Stalemate");
        return;
      }
    } catch (error) {
      console.error(
        "BioCorruption position validation:",
        error
      );
    }

    // King escape validation after infection ends
    if (nextPhase === "countdown" && nextCorrupted.length === 0) {
      const whiteKing = getKingSquare(nextBoard, "w");
      const blackKing = getKingSquare(nextBoard, "b");

      if (whiteKing && corrupted.includes(whiteKing)) {
        finishGame(
          "b",
          "White king could not escape the infection."
        );
        return;
      }

      if (blackKing && corrupted.includes(blackKing)) {
        finishGame(
          "w",
          "Black king could not escape the infection."
        );
        return;
      }
    }

    // King trapped in active infection zone
    if (nextCorrupted.length > 0) {
      const nextKingSquare = getKingSquare(nextBoard, nextTurn);

      if (
        nextKingSquare &&
        nextCorrupted.includes(nextKingSquare)
      ) {
        const escapeMoves = panicMoves(
          nextBoard,
          nextTurn,
          nextCorrupted,
          getMoves,
          moveResult.enPassant ?? null,
          moveResult.castling ?? castling
        );

        if (!escapeMoves || escapeMoves.length === 0) {
          finishGame(
            turn,
            `${PLAYERS[nextTurn]}'s king is trapped in the infection zone.`
          );
        }
      }
    }
  }

  function handleSquareClick(square) {
    if (winner || screen !== "game") return;

    if (gameMode === "ai" && turn !== playerColor) return;

    if (selected && targets.includes(square)) {
      makeTurn(selected, square);
      return;
    }

    const piece = board[square];

    if (piece?.color === turn) {
      const moves = getAvailableMoves(
        board,
        square,
        turn,
        enPassant,
        castling,
        corrupted
      );

      if (moves.length) {
        setSelected(square);
        setTargets(moves);
      } else {
        setSelected(null);
        setTargets([]);
      }

      return;
    }

    setSelected(null);
    setTargets([]);
  }

  function resign() {
    if (winner) return;
    finishGame(opposite(turn), "Resignation");
  }

  function showNotice(text) {
    setNotice(text);
    setTimeout(() => setNotice(""), 3500);
  }

  function offerDraw() {
    if (winner || drawOffer) return;

    if (gameMode === "ai") {
      if (turn !== playerColor) return;

      // AI accepts only when it is clearly behind in material.
      const aiColor = opposite(playerColor);
      const behind =
        getMaterialCount(board, playerColor) -
        getMaterialCount(board, aiColor);

      if (behind >= 3) {
        finishGame("draw", "Draw agreed");
      } else {
        showNotice(`${PLAYERS[aiColor]} declined the draw offer.`);
      }

      return;
    }

    setDrawOffer(opposite(turn));
  }

  function acceptDraw() {
    if (!drawOffer || winner) return;
    finishGame("draw", "Draw agreed");
  }

  function declineDraw() {
    setDrawOffer(null);
  }

  function sendChat() {
    const message = chatInput.trim();

    if (!message) return;

    setMessages((old) => [
      ...old,
      {
        id: Date.now(),
        sender: turn,
        text: message,
      },
    ]);

    setChatInput("");
  }

  const humanTurnInAi = gameMode === "ai" && turn === playerColor;
  const undoSteps = gameMode === "ai" && humanTurnInAi ? 2 : 1;
  const canUndo = history.length >= undoSteps && !winner;

  function undoMove() {
    if (!canUndo) return;

    if (aiTimer.current) {
      clearTimeout(aiTimer.current);
      aiTimer.current = null;
    }

    const previous = history[history.length - undoSteps];

    setMoveLog(previous.moveLog);
    setConvertedTotal(previous.convertedTotal);
    setElapsed(previous.elapsed);

    setBoard(previous.board);
    setTurn(previous.turn);
    setCorrupted(previous.corrupted);
    setPlies(previous.plies);
    setTime(previous.time);
    setEnPassant(previous.enPassant);
    setCastling(previous.castling);
    setLastMove(previous.lastMove);
    setWinner(previous.winner);
    setWinReason(previous.winReason);

    setCyclePhase(previous.cyclePhase);
    setCycleMoves(previous.cycleMoves);
    setWarningSquare(previous.warningSquare);
    setDefenseMovesLeft(previous.defenseMovesLeft);
    setCycleNumber(previous.cycleNumber);
    setLastTransformation(previous.lastTransformation);

    setHistory((old) => old.slice(0, old.length - undoSteps));
    setSelected(null);
    setTargets([]);
  }

  useEffect(() => {
    setResultOpen(!!winner);
  }, [winner]);

  useEffect(() => {
    if (screen !== "game" || winner) return undefined;

    const timer = setInterval(() => {
      setElapsed((old) => old + 1);

      setTime((old) => {
        if (old[turn] <= 1) {
          clearInterval(timer);
          setWinner(opposite(turn));
          setWinReason("Time expired");

          return {
            ...old,
            [turn]: 0,
          };
        }

        return {
          ...old,
          [turn]: old[turn] - 1,
        };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [turn, screen, winner]);

  useEffect(() => {
    if (
      screen !== "game" ||
      gameMode !== "ai" ||
      winner ||
      turn === playerColor
    ) {
      return undefined;
    }

    let cancelled = false;

    aiTimer.current = setTimeout(async () => {
      const started = Date.now();
      let move = null;

      try {
        const picked = await aiRunner.current.ask(
          {
            board,
            turn,
            enPassant,
            castling,
            phase: cyclePhase,
            cycleMoves,
            warningSquare,
            corrupted,
            defenseMovesLeft,
          },
          aiLevel
        );

        // keep a natural pause even when the AI answers instantly
        const wait = 500 - (Date.now() - started);
        if (wait > 0) {
          await new Promise((resolve) => setTimeout(resolve, wait));
        }

        if (cancelled) return;

        // AI move is always re-validated with the real game rules.
        if (
          picked &&
          getAvailableMoves(
            board,
            picked.from,
            turn,
            enPassant,
            castling,
            corrupted
          ).includes(picked.to)
        ) {
          move = picked;
        }
      } catch (error) {
        console.error("BioCorruption AI:", error);
      }

      if (cancelled) return;

      if (!move) {
        move = getRandomMove(
          board,
          turn,
          enPassant,
          castling,
          corrupted
        );
      }

      if (move) {
        makeTurn(move.from, move.to);
      } else {
        try {
          const position = createChessPosition(
            board,
            turn,
            enPassant,
            castling
          );

          if (position.isCheckmate()) {
            finishGame(playerColor, "Checkmate");
          } else if (position.isStalemate()) {
            finishGame("draw", "Stalemate");
          } else {
            finishGame(
              playerColor,
              "No legal moves available."
            );
          }
        } catch (error) {
          console.error("AI position validation:", error);
        }
      }
    }, 100);

    return () => {
      cancelled = true;
      aiRunner.current.cancel();

      if (aiTimer.current) {
        clearTimeout(aiTimer.current);
      }
    };
  }, [
    board,
    turn,
    gameMode,
    playerColor,
    winner,
    screen,
    enPassant,
    castling,
    corrupted,
    cyclePhase,
    cycleMoves,
    warningSquare,
    defenseMovesLeft,
    aiLevel,
  ]);

  useEffect(() => {
    const runner = aiRunner.current;

    return () => {
      runner.cancel();

      if (aiTimer.current) {
        clearTimeout(aiTimer.current);
      }
    };
  }, []);

  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds)) return "∞";

    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;

    return `${String(mins).padStart(2, "0")}:${String(
      secs
    ).padStart(2, "0")}`;
  };

  const phaseLabel =
    cyclePhase === "countdown"
      ? `Next warning in ${MOVES_PER_CYCLE - cycleMoves} moves`
      : cyclePhase === "warning"
        ? "⚠ Infection warning — next move activates"
        : `Defend your pieces — ${defenseMovesLeft} moves left`;

  if (screen === "setup") {
    const sides = [
      { id: "w", label: "White", glyph: "♚", tile: "w" },
      { id: "random", label: "Random", glyph: "?", tile: "r" },
      { id: "b", label: "Black", glyph: "♚", tile: "b" },
    ];

    const sideText =
      selectedSide === "random"
        ? "random side"
        : selectedSide === "w"
          ? "White"
          : "Black";

    return (
      <main className="fog-page">
        <div className="fog-setup">
          <section className="fog-setup-card">
            <div className="fog-setup-head">
              <div>
                <span className="fog-eyebrow">QELVARIS CHESS · BIOCORRUPTION</span>
                <h1>New game</h1>
              </div>
            </div>

            <p className="fog-setup-sub">
              The infection is spreading. Keep your pieces out of the zone and protect your king.
            </p>

            <div className="fog-tabs" role="tablist">
              {[
                { id: "ai", label: "vs AI" },
                { id: "friend", label: "Friend" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  className="fog-tab"
                  aria-selected={gameMode === tab.id}
                  onClick={() => setGameMode(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="fog-field">
              <p className="fog-lbl">Play as</p>
              <div className="fog-picks">
                {sides.map((side) => (
                  <button
                    key={side.id}
                    type="button"
                    className="fog-pick"
                    aria-pressed={selectedSide === side.id}
                    onClick={() => setSelectedSide(side.id)}
                  >
                    <span className={`fog-tile fog-tile--${side.tile}`}>
                      {side.glyph}
                    </span>
                    {side.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="fog-field">
              <p className="fog-lbl">Time</p>
              <div className="fog-chips">
                {TIME_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className="fog-chip"
                    aria-pressed={timeId === option.id}
                    onClick={() => setTimeId(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {gameMode === "ai" ? (
              <section className="fog-panel-box">
                <div className="fog-row">
                  <span className="fog-lbl">AI level</span>
                  <strong>{AI_LEVELS[aiLevel - 1].name}</strong>
                </div>

                <input
                  type="range"
                  className="fog-range"
                  min="1"
                  max="5"
                  value={aiLevel}
                  onChange={(event) => setAiLevel(Number(event.target.value))}
                  aria-label="AI level"
                />

                <p className="fog-hint-text">
                  Level {aiLevel}: {AI_LEVELS[aiLevel - 1].hint}
                </p>
              </section>
            ) : (
              <section className="fog-panel-box">
                <p className="fog-hint-text">
                  Both players use this screen and take turns. Player 1 is White, Player 2 is Black.
                </p>
              </section>
            )}

            <button
              type="button"
              onClick={() => startGame()}
              className="fog-primary-button fog-start"
            >
              Start game →
            </button>

            <p className="fog-status-text">
              Ready:{" "}
              {gameMode === "ai"
                ? `you play ${sideText} vs Bio AI (level ${aiLevel})`
                : "pass & play on this device"}{" "}
              · {timeOption.label}
            </p>

            {onBack && (
              <button type="button" className="fog-link-button" onClick={onBack}>
                ← Back to game modes
              </button>
            )}
          </section>
        </div>
      </main>
    );
  }

  const leftColor = gameMode === "ai" ? playerColor : "w";
  const rightColor = opposite(leftColor);

  const resultTone =
    winner === "draw"
      ? "draw"
      : gameMode === "ai"
        ? winner === playerColor
          ? "win"
          : "loss"
        : "win";

  const resultTitle =
    winner === "draw"
      ? "Draw"
      : gameMode === "ai"
        ? winner === playerColor
          ? "You won"
          : "You lost"
        : `${PLAYERS[winner] || ""} wins`;

  const leftScore =
    winner === "draw" ? "½" : winner === leftColor ? "1" : "0";
  const rightScore =
    winner === "draw" ? "½" : winner === rightColor ? "1" : "0";

  const whiteMaterial = getMaterialCount(board, "w");
  const blackMaterial = getMaterialCount(board, "b");

  return (
    <div className="bio-root">
      <div className="bio-game">
        <div className="bio-topbar">
          <button onClick={backToGameModes}>
            ← Back to Game Modes
          </button>

          <div className="bio-top-brand">☣ BioCorruption</div>

          <button onClick={() => startGame(playerColor)}>
            ↻ Restart
          </button>
        </div>

        <div className="bio-layout">
          <aside className="bio-sidebar">
            <div
              className={`bio-player ${
                turn === "b" ? "active" : ""
              }`}
            >
              <span className="bio-avatar">♚</span>

              <div>
                <strong>Omega</strong>
                <small>Black player</small>
              </div>

              <b>{formatTime(time.b)}</b>
            </div>

            <div
              className={`bio-player ${
                turn === "w" ? "active" : ""
              }`}
            >
              <span className="bio-avatar">♔</span>

              <div>
                <strong>Alpha</strong>
                <small>White player</small>
              </div>

              <b>{formatTime(time.w)}</b>
            </div>

            <div className="bio-status">
              <span>INFECTION STATUS</span>

              <strong>
                {corrupted.length} infected squares
              </strong>

              <div className="bio-progress">
                <i
                  style={{
                    width: `${Math.min(
                      100,
                      (corrupted.length / 64) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>

            <div className="bio-material">
              <span>WHITE MATERIAL</span>
              <strong>{whiteMaterial}</strong>

              <span>BLACK MATERIAL</span>
              <strong>{blackMaterial}</strong>
            </div>

            <div className="bio-actions">
              <button onClick={resign} disabled={!!winner}>
                Resign
              </button>

              <button
                onClick={offerDraw}
                disabled={
                  !!winner ||
                  !!drawOffer ||
                  (gameMode === "ai" && turn !== playerColor)
                }
              >
                Offer Draw
              </button>

              <button
                onClick={undoMove}
                disabled={!canUndo}
              >
                Undo Move
              </button>

              <button onClick={() => setChatOpen((open) => !open)}>
                {chatOpen ? "Close Chat" : "Chat"}
              </button>
            </div>
          </aside>

          <main className="bio-board-area">
            <div className="bio-turn">
              {winner
                ? winner === "draw"
                  ? "DRAW"
                  : `${PLAYERS[winner]} WINS`
                : gameMode === "ai" && turn !== playerColor
                  ? `${currentPlayerName} (AI) is thinking…`
                  : `${currentPlayerName}'s turn`}

              {winner && !resultOpen && (
                <>
                  <button
                    className="bio-reopen"
                    onClick={() => setResultOpen(true)}
                  >
                    Result
                  </button>

                  <button className="bio-reopen" onClick={rematch}>
                    ↻ Rematch
                  </button>
                </>
              )}
            </div>

            {notice && <div className="bio-notice">{notice}</div>}

            <div className="bio-board-frame">
              <BioBoard
                fen={boardToFen(board)}
                flipped={playerColor === "b"}
                lastMove={lastMove}
                selected={selected}
                targets={targets}
                onSquareClick={handleSquareClick}
                fog={false}
                visibleSquares={[]}
                infectionSquares={corrupted}
                warningSquare={
                  cyclePhase === "warning"
                    ? warningSquare
                    : null
                }
                transformedSquares={lastTransformation.map(
                  (item) => item.square
                )}
              />

              {drawOffer && !winner && (
                <div className="bio-result-overlay">
                  <div className="bio-draw-dialog" role="dialog">
                    <strong>Draw offer received</strong>

                    <p>{PLAYERS[drawOffer]} has offered a draw.</p>

                    <button onClick={acceptDraw}>Accept Draw</button>
                    <button onClick={declineDraw}>Decline</button>
                  </div>
                </div>
              )}

              <div className="bio-corruption-overlay">
                {cyclePhase === "warning" && warningSquare && (
                  <span>
                    ⚠ Warning at {warningSquare} — infection activates
                    after the next move
                  </span>
                )}

                {cyclePhase === "defense" && (
                  <span>
                    ☣ Infection active — {defenseMovesLeft} defence
                    moves remaining
                  </span>
                )}

                {cyclePhase === "countdown" && (
                  <span>
                    {phaseLabel} · Cycle {cycleNumber}
                  </span>
                )}
              </div>
            </div>

            {lastTransformation.length > 0 && (
              <div className="bio-log">
                <strong>Last transformation</strong>

                <p>
                  {lastTransformation.length} piece(s) changed team.
                </p>

                <small>
                  Pieces can change back in a future infection cycle.
                </small>
              </div>
            )}

          </main>

          <aside className="bio-sidebar bio-right">
            <div className="bio-log">
              <span>GAME STATUS</span>

              <h3>
                {winner ? "Game over" : "Survive the infection"}
              </h3>

              <p>{phaseLabel}</p>

              {warningSquare && cyclePhase === "warning" && (
                <p>Warning square: {warningSquare}</p>
              )}

              {cyclePhase === "defense" && (
                <p>
                  Keep your pieces out of the infected zone before
                  the defence timer ends.
                </p>
              )}
            </div>

            <div className="bio-log">
              <span>MOVE COUNT</span>
              <strong>{plies}</strong>
            </div>

            <div className="bio-log">
              <span>CYCLE</span>
              <strong>{cycleNumber}</strong>
            </div>

            {gameMode === "ai" && (
              <div className="bio-log">
                <span>AI LEVEL</span>
                <strong>
                  {aiLevel} · {AI_LEVELS[aiLevel - 1].name}
                </strong>
              </div>
            )}

            <div className="bio-log">
              <span>TIME CONTROL</span>
              <strong>{timeOption.label}</strong>
            </div>

            <div className="bio-log">
              <span>GAME MODE</span>
              <strong>
                {gameMode === "ai"
                  ? "Play vs AI"
                  : gameMode === "friend"
                    ? "Local 2 Player"
                    : "Online Multiplayer"}
              </strong>
            </div>
          </aside>
        </div>


        {winner && resultOpen && (
          <div
            className="fog-page"
            style={{ padding: 0, margin: 0, gap: 0, height: 0, maxWidth: "none" }}
          >
            <div className="fog-dialog-overlay fog-dialog-overlay--page">
              <section
                className="fog-post-card"
                data-tone={resultTone}
                role="dialog"
                aria-label="Match result"
              >
                <div className="fog-post-top">
                  <span>
                    {gameMode === "ai"
                      ? `vs Bio AI · Lv ${aiLevel}`
                      : "Local match"}{" "}
                    · {timeOption.label}
                  </span>

                  <button
                    type="button"
                    className="fog-tool fog-tool--icon"
                    onClick={() => setResultOpen(false)}
                    aria-label="Close and view board"
                    title="View board"
                  >
                    ✕
                  </button>
                </div>

                <div className="fog-post-res">
                  <h2>{resultTitle}</h2>
                  <p>{winReason}</p>
                </div>

                <div className="fog-post-players">
                  <div className="fog-post-pl">
                    <span className={`fog-tile fog-tile--${leftColor}`}>♚</span>
                    <div>
                      <b>{PLAYERS[leftColor]}</b>
                      <small>{leftColor === "w" ? "White" : "Black"}</small>
                    </div>
                  </div>

                  <span className="fog-post-score">
                    {leftScore} – {rightScore}
                  </span>

                  <div className="fog-post-pl fog-post-pl--r">
                    <span className={`fog-tile fog-tile--${rightColor}`}>♚</span>
                    <div>
                      <b>{PLAYERS[rightColor]}</b>
                      <small>{rightColor === "w" ? "White" : "Black"}</small>
                    </div>
                  </div>
                </div>

                <div
                  className="fog-post-stats"
                  style={{ gridTemplateColumns: "repeat(4, 1fr)" }}
                >
                  <div>
                    <b>{plies}</b>
                    <small>Moves</small>
                  </div>
                  <div>
                    <b>{formatTime(elapsed)}</b>
                    <small>Time</small>
                  </div>
                  <div>
                    <b>{cycleNumber}</b>
                    <small>Cycles</small>
                  </div>
                  <div>
                    <b>{convertedTotal}</b>
                    <small>Converted</small>
                  </div>
                </div>

                <div className="fog-post-actions">
                  <button type="button" className="fog-primary-button" onClick={rematch}>
                    Rematch
                  </button>

                  <label className="fog-swap">
                    <input
                      type="checkbox"
                      checked={swapColors}
                      onChange={(event) => setSwapColors(event.target.checked)}
                    />
                    Swap colors
                  </label>

                  <div className="fog-post-grid">
                    <button type="button" className="fog-secondary-button" onClick={newGame}>
                      New game
                    </button>
                    <button type="button" className="fog-secondary-button" onClick={copyLog}>
                      Copy log
                    </button>
                    <button
                      type="button"
                      className="fog-secondary-button"
                      onClick={() => setResultOpen(false)}
                    >
                      View board
                    </button>
                    <button type="button" className="fog-secondary-button" onClick={goHome}>
                      Home
                    </button>
                  </div>
                </div>

                <p className="fog-status-text" role="status">
                  {copyState === "copied"
                    ? "Log copied"
                    : copyState === "failed"
                      ? "Could not copy"
                      : ""}
                </p>
              </section>
            </div>
          </div>
        )}

        {chatOpen && (
          <div className="bio-chat">
            <div className="bio-chat-heading">
              <strong>Local Chat</strong>

              <button onClick={() => setChatOpen(false)}>
                ×
              </button>
            </div>

            <div className="bio-chat-messages">
              {messages.length === 0 && (
                <p className="bio-empty-chat">
                  No messages yet.
                </p>
              )}

              {messages.map((message) => (
                <div
                  className="bio-chat-message"
                  key={message.id}
                >
                  <b>{PLAYERS[message.sender]}</b>
                  <p>{message.text}</p>
                </div>
              ))}
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                sendChat();
              }}
            >
              <input
                value={chatInput}
                onChange={(event) =>
                  setChatInput(event.target.value)
                }
                placeholder="Write a message..."
              />

              <button type="submit">Send</button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}