import { useEffect, useMemo, useRef, useState } from "react";
import Board from "../../Board";
import {
  createInitialBoard,
  getMoves,
  applyMove,
  getGameStatus,
} from "./fogEngine";
import { getVisibility, createVisibleFen } from "./fogVisibility";
import "./FogOfWar.css";

const TIME_OPTIONS = [
  { id: "1+0", label: "1 min", base: 60, inc: 0 },
  { id: "3+2", label: "3+2", base: 180, inc: 2 },
  { id: "5+0", label: "5 min", base: 300, inc: 0 },
  { id: "10+0", label: "10 min", base: 600, inc: 0 },
  { id: "15+10", label: "15+10", base: 900, inc: 10 },
  { id: "none", label: "No limit", base: null, inc: 0 },
];

const AI_LEVELS = ["Beginner", "Easy", "Medium", "Hard", "Master"];
const PIECE_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const FILES = "abcdefgh";

const LETTER = {
  n: "N",
  b: "B",
  r: "R",
  q: "Q",
  k: "K",
  p: "",
};

const PROMO_GLYPH = {
  w: { q: "♕", r: "♖", b: "♗", n: "♘" },
  b: { q: "♛", r: "♜", b: "♝", n: "♞" },
};

const initialCastling = () => ({
  wK: true,
  wQ: true,
  bK: true,
  bQ: true,
});

const fmt = (seconds) =>
  seconds === Infinity
    ? "∞"
    : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

function notate(board, from, to, promo = "q") {
  const piece = board[from];

  if (!piece) return to;

  if (
    piece.type === "k" &&
    Math.abs(FILES.indexOf(to[0]) - FILES.indexOf(from[0])) === 2
  ) {
    return to[0] === "g" ? "O-O" : "O-O-O";
  }

  const isCapture =
    Boolean(board[to]) || (piece.type === "p" && from[0] !== to[0]);

  let notation = LETTER[piece.type];

  if (piece.type === "p" && isCapture) notation += from[0];
  if (isCapture) notation += "x";

  notation += to;

  if (piece.type === "p" && (to[1] === "8" || to[1] === "1")) {
    notation += `=${promo.toUpperCase()}`;
  }

  return notation;
}

function Icon({ children, size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function BackIcon() {
  return (
    <Icon>
      <path d="m15 18-6-6 6-6" />
      <path d="M9 12h12" />
    </Icon>
  );
}

function RestartIcon() {
  return (
    <Icon>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 7v5l3 2" />
    </Icon>
  );
}

function FlipIcon() {
  return (
    <Icon>
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
      <path d="M9 9l-5-5M15 9l5-5M9 15l-5 5M15 15l5 5" />
    </Icon>
  );
}

function ThemeIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v18a9 9 0 0 0 0-18z" fill="currentColor" />
    </Icon>
  );
}

function FlagIcon() {
  return (
    <Icon>
      <path d="M5 21V5" />
      <path d="M5 5c5-4 9 4 14 0v11c-5 4-9-4-14 0" />
    </Icon>
  );
}

function DrawIcon() {
  return (
    <Icon>
      <path d="M8 12h8" />
      <path d="M12 8v8" />
      <circle cx="12" cy="12" r="9" />
    </Icon>
  );
}

function ChatIcon() {
  return (
    <Icon>
      <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z" />
    </Icon>
  );
}

export default function FogOfWar({ onBack }) {
  const [board, setBoard] = useState(createInitialBoard);
  const [turn, setTurn] = useState("w");
  const [selected, setSelected] = useState(null);
  const [lastMove, setLastMove] = useState(null);
  const [enPassant, setEnPassant] = useState(null);
  const [castling, setCastling] = useState(initialCastling);
  const [winner, setWinner] = useState(null);
  const [winReason, setWinReason] = useState("");
  const [promotion, setPromotion] = useState(null);
  const [history, setHistory] = useState([]);
  const [timeId, setTimeId] = useState("5+0");
  const [aiLevel, setAiLevel] = useState(3);
  const timeControl =
    TIME_OPTIONS.find((option) => option.id === timeId) || TIME_OPTIONS[2];
  const startSecs = timeControl.base ?? Infinity;
  const [time, setTime] = useState({ w: 300, b: 300 });
  const [elapsed, setElapsed] = useState(0);
  const [resultHidden, setResultHidden] = useState(false);
  const [swapColors, setSwapColors] = useState(true);
  const [copyState, setCopyState] = useState("");

  const [gameStarted, setGameStarted] = useState(false);
  const [gameMode, setGameMode] = useState("ai");
  const [selectedSide, setSelectedSide] = useState("w");
  const [humanColor, setHumanColor] = useState("w");

  const [autoFlip, setAutoFlip] = useState(true);
  const [altTheme, setAltTheme] = useState(false);

  const [activeTab, setActiveTab] = useState("moves");
  const [chatMessages, setChatMessages] = useState([
    {
      id: 1,
      player: "System",
      text: "Welcome to Fog of War. Good luck!",
      system: true,
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [drawOffer, setDrawOffer] = useState(null);
  const [dialog, setDialog] = useState(null);

  const movesRef = useRef(null);
  const chatRef = useRef(null);

  const PLAYERS = {
    w:
      gameMode === "local"
        ? "Player 1"
        : humanColor === "w"
          ? "You"
          : "VectorCheck",

    b:
      gameMode === "local"
        ? "Player 2"
        : humanColor === "b"
          ? "You"
          : "VectorCheck",
  };

  const visibilityTurn = gameMode === "ai" ? humanColor : turn;

  const visible = useMemo(
    () => getVisibility(board, visibilityTurn, enPassant, castling),
    [board, visibilityTurn, enPassant, castling]
  );

  const fen = useMemo(
    () => createVisibleFen(board, visible),
    [board, visible]
  );

  const targets = useMemo(
    () => (selected ? getMoves(board, selected, enPassant, castling) : []),
    [board, selected, enPassant, castling]
  );

  const aiThinking =
    gameStarted &&
    gameMode === "ai" &&
    turn !== humanColor &&
    !winner;

  // Clock
  useEffect(() => {
    if (!gameStarted || winner || aiThinking) return undefined;

    const id = setInterval(() => {
      setElapsed((value) => value + 1);
      setTime((current) => ({
        ...current,
        [turn]: Math.max(0, current[turn] - 1),
      }));
    }, 1000);

    return () => clearInterval(id);
  }, [turn, winner, gameStarted, aiThinking]);

  useEffect(() => {
    if (gameStarted && !winner && time[turn] === 0) {
      setWinner(turn === "w" ? "b" : "w");
      setWinReason("Won on time");
      setDrawOffer(null);
    }
  }, [time, turn, winner, gameStarted]);

  useEffect(() => {
    if (movesRef.current) {
      movesRef.current.scrollTop = movesRef.current.scrollHeight;
    }
  }, [history]);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const addSystemMessage = (text) => {
    setChatMessages((old) => [
      ...old,
      {
        id: Date.now() + Math.random(),
        player: "System",
        text,
        system: true,
      },
    ]);
  };

  const startGame = (forcedSide) => {
    const pick = typeof forcedSide === "string" ? forcedSide : selectedSide;

    const finalSide =
      pick === "random" ? (Math.random() < 0.5 ? "w" : "b") : pick;

    setHumanColor(finalSide);
    setBoard(createInitialBoard());
    setTurn("w");
    setSelected(null);
    setLastMove(null);
    setEnPassant(null);
    setCastling(initialCastling());
    setWinner(null);
    setWinReason("");
    setPromotion(null);
    setHistory([]);
    setTime({ w: startSecs, b: startSecs });
    setElapsed(0);
    setResultHidden(false);
    setCopyState("");
    setDrawOffer(null);
    setDialog(null);
    setChatInput("");
    setActiveTab("moves");
    setGameStarted(true);

    setChatMessages([
      {
        id: Date.now(),
        player: "System",
        text:
          gameMode === "ai"
            ? `Game started. You are ${finalSide === "w" ? "White" : "Black"}. Your opponent is VectorCheck.`
            : `Pass & Play started. Player 1 is ${finalSide === "w" ? "White" : "Black"}.`,
        system: true,
      },
    ]);
  };

  const makeTurn = (from, to, promotionPiece = "q") => {
    const label = notate(board, from, to, promotionPiece);

    const result = applyMove(
      board,
      from,
      to,
      enPassant,
      castling,
      promotionPiece
    );

    if (!result) return;

    setBoard(result.board);
    setCastling(result.castling);
    setEnPassant(result.enPassant);
    setLastMove({ from, to });
    setHistory((old) => [...old, label]);
    setTime((current) => ({
      ...current,
      [turn]: current[turn] + timeControl.inc,
    }));
    setSelected(null);
    setPromotion(null);

    const nextTurn = turn === "w" ? "b" : "w";
const status = getGameStatus(
  result.board,
  nextTurn,
  result.enPassant,
  result.castling
);

if (status.state === "checkmate" || status.state === "stalemate") {
  setWinner(status.winner);
  setWinReason(status.reason);
  setDrawOffer(null);
} else {
  setTurn(nextTurn);
}
  };

  // VectorCheck: level 1 random, higher levels prefer captures and avoid hanging pieces
  const chooseAiMove = (moves) => {
    if (aiLevel <= 1) {
      return moves[Math.floor(Math.random() * moves.length)];
    }

    const noise = [0, 4, 2, 0.8, 0.2][aiLevel - 1];
    const riskWeight = aiLevel >= 4 ? 1 : aiLevel === 3 ? 0.5 : 0;

    let best = null;

    moves.forEach((move) => {
      const target = board[move.to];
      const gain = target ? PIECE_VALUE[target.type] || 0 : 0;
      let risk = 0;

      if (riskWeight) {
        const after = applyMove(board, move.from, move.to, enPassant, castling, "q");

        if (after) {
          Object.entries(after.board).forEach(([square, piece]) => {
            if (!piece || piece.color === turn) return;

            getMoves(after.board, square, after.enPassant, after.castling).forEach(
              (to) => {
                const victim = after.board[to];
                if (victim) risk = Math.max(risk, PIECE_VALUE[victim.type] || 0);
              }
            );
          });
        }
      }

      const score = gain - risk * riskWeight + Math.random() * noise;
      if (!best || score > best.score) best = { move, score };
    });

    return best.move;
  };

  // VectorCheck legal-move opponent
  useEffect(() => {
    if (
      !gameStarted ||
      gameMode !== "ai" ||
      turn === humanColor ||
      winner ||
      promotion ||
      drawOffer ||
      dialog
    ) {
      return undefined;
    }

    const timer = setTimeout(() => {
      const possibleMoves = [];

      Object.entries(board).forEach(([square, piece]) => {
        if (!piece || piece.color !== turn) return;

        const moves = getMoves(
          board,
          square,
          enPassant,
          castling
        );

        moves.forEach((target) => {
          possibleMoves.push({
            from: square,
            to: target,
          });
        });
      });

      if (possibleMoves.length === 0) {
        setWinner(humanColor);
        setWinReason("VectorCheck has no available moves");
        return;
      }

      const chosen = chooseAiMove(possibleMoves);

      const movingPiece = board[chosen.from];

      const isPromotion =
        movingPiece?.type === "p" &&
        (chosen.to[1] === "8" || chosen.to[1] === "1");

      const promotionPiece = isPromotion ? "q" : "q";

      const label = notate(
        board,
        chosen.from,
        chosen.to,
        promotionPiece
      );

      const result = applyMove(
        board,
        chosen.from,
        chosen.to,
        enPassant,
        castling,
        promotionPiece
      );

      if (!result) return;

      setBoard(result.board);
      setCastling(result.castling);
      setEnPassant(result.enPassant);
      setLastMove({
        from: chosen.from,
        to: chosen.to,
      });
      setHistory((old) => [...old, label]);
      setTime((current) => ({
        ...current,
        [turn]: current[turn] + timeControl.inc,
      }));

      const nextTurn = turn === "w" ? "b" : "w";
const status = getGameStatus(
  result.board,
  nextTurn,
  result.enPassant,
  result.castling
);

if (status.state === "checkmate" || status.state === "stalemate") {
  setWinner(status.winner);
  setWinReason(status.reason);
  setDrawOffer(null);
} else {
  setTurn(nextTurn);
}
    }, 900);

    return () => clearTimeout(timer);
  }, [
    gameStarted,
    gameMode,
    turn,
    humanColor,
    winner,
    promotion,
    drawOffer,
    dialog,
    board,
    enPassant,
    castling,
    aiLevel,
  ]);

  const handleSquareClick = (square) => {
    if (
      !gameStarted ||
      winner ||
      promotion ||
      dialog ||
      drawOffer ||
      aiThinking
    ) {
      return;
    }

    if (selected && targets.includes(square)) {
      const piece = board[selected];

      if (
        piece.type === "p" &&
        (square[1] === "8" || square[1] === "1")
      ) {
        setPromotion({ from: selected, to: square });
      } else {
        makeTurn(selected, square);
      }

      return;
    }

    setSelected(
      board[square]?.color === turn ? square : null
    );
  };

  const restart = () => {
    setBoard(createInitialBoard());
    setTurn("w");
    setSelected(null);
    setLastMove(null);
    setEnPassant(null);
    setCastling(initialCastling());
    setWinner(null);
    setWinReason("");
    setPromotion(null);
    setHistory([]);
    setTime({ w: startSecs, b: startSecs });
    setElapsed(0);
    setResultHidden(false);
    setCopyState("");
    setDrawOffer(null);
    setDialog(null);
    setChatMessages([
      {
        id: Date.now(),
        player: "System",
        text: "New game started. Good luck!",
        system: true,
      },
    ]);
    setChatInput("");
    setActiveTab("moves");
  };

  const confirmResign = () => {
    setWinner(turn === "w" ? "b" : "w");
    setWinReason(`${PLAYERS[turn]} resigned`);
    setDrawOffer(null);
    setDialog(null);
    addSystemMessage(`${PLAYERS[turn]} resigned.`);
  };

  const offerDraw = () => {
    if (winner || drawOffer || !gameStarted) return;

    setDrawOffer({ by: turn });
    setSelected(null);
    addSystemMessage(`${PLAYERS[turn]} offered a draw.`);
  };

  const respondToDraw = (accepted) => {
    if (!drawOffer) return;

    if (accepted) {
      setWinner("draw");
      setWinReason("Draw agreed");
      addSystemMessage("The game ended in a draw.");
    } else {
      addSystemMessage(`${PLAYERS[turn]} declined the draw offer.`);
    }

    setDrawOffer(null);
  };

  const sendMessage = (event) => {
    event.preventDefault();

    const message = chatInput.trim();
    if (!message || winner || !gameStarted) return;

    setChatMessages((old) => [
      ...old,
      {
        id: Date.now(),
        player: PLAYERS[turn],
        color: turn,
        text: message,
      },
    ]);

    setChatInput("");
  };

  const rows = [];

  for (let i = 0; i < history.length; i += 2) {
    rows.push({
      n: i / 2 + 1,
      w: history[i],
      b: history[i + 1],
    });
  }

  const flipped = autoFlip && humanColor === "b";
  const low = time[turn] <= 30;
  const gameOver = Boolean(winner);

  // SETUP SCREEN
  if (!gameStarted) {
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
      <main className={`fog-page ${altTheme ? "fog-theme-alt" : ""}`}>
        <div className="fog-setup">
          <section className="fog-setup-card">
            <div className="fog-setup-head">
              <div>
                <span className="fog-eyebrow">QELVARIS CHESS · FOG OF WAR</span>
                <h1>New game</h1>
              </div>

              <button
                type="button"
                className={`fog-tool fog-tool--icon ${altTheme ? "on" : ""}`}
                onClick={() => setAltTheme((value) => !value)}
                aria-label="Switch board theme"
                title="Board theme"
              >
                <ThemeIcon />
              </button>
            </div>

            <p className="fog-setup-sub">
              Only the squares your pieces can see are revealed. Find what you cannot see.
            </p>

            <div className="fog-tabs" role="tablist">
              {[
                { id: "ai", label: "vs AI" },
                { id: "local", label: "Friend" },
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
                  <strong>{AI_LEVELS[aiLevel - 1]}</strong>
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
                  Level 1 plays random moves. Level 5 grabs material and avoids hanging pieces.
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
              Ready: {gameMode === "ai" ? `you play ${sideText} vs VectorCheck (level ${aiLevel})` : "pass & play on this device"} ·{" "}
              {timeControl.base ? timeControl.label : "no limit"}
            </p>

            <button type="button" className="fog-link-button" onClick={onBack}>
              ← Back to game modes
            </button>
          </section>
        </div>
      </main>
    );
  }

  // GAME SCREEN
  const leftColor = gameMode === "ai" ? humanColor : "w";
  const rightColor = leftColor === "w" ? "b" : "w";

  const resultTone =
    winner === "draw"
      ? "draw"
      : gameMode === "ai"
        ? winner === humanColor
          ? "win"
          : "loss"
        : "win";

  const resultTitle =
    winner === "draw"
      ? "Draw"
      : gameMode === "ai"
        ? winner === humanColor
          ? "You won"
          : "You lost"
        : `${PLAYERS[winner] || ""} wins`;

  const leftScore =
    winner === "draw" ? "½" : winner === leftColor ? "1" : "0";
  const rightScore =
    winner === "draw" ? "½" : winner === rightColor ? "1" : "0";

  const captureCount = history.filter((move) => move.includes("x")).length;

  const buildPgn = () => {
    const result =
      winner === "draw" ? "1/2-1/2" : winner === "w" ? "1-0" : winner === "b" ? "0-1" : "*";

    const head = [
      `[Event "Qelvaris Fog of War"]`,
      `[Date "${new Date().toISOString().slice(0, 10).replace(/-/g, ".")}"]`,
      `[White "${PLAYERS.w}"]`,
      `[Black "${PLAYERS.b}"]`,
      `[Result "${result}"]`,
      `[TimeControl "${timeControl.base ? `${timeControl.base}+${timeControl.inc}` : "-"}"]`,
    ].join("\n");

    const body = rows
      .map((row) => `${row.n}. ${row.w}${row.b ? ` ${row.b}` : ""}`)
      .join(" ");

    return `${head}\n\n${body} ${result}`;
  };

  const copyPgn = async () => {
    try {
      await navigator.clipboard.writeText(buildPgn());
      setCopyState("PGN copied");
    } catch {
      setCopyState("Could not copy");
    }
  };

  const rematch = () => {
    const nextSide = swapColors
      ? humanColor === "w"
        ? "b"
        : "w"
      : humanColor;

    startGame(nextSide);
  };

  const newGame = () => {
    setGameStarted(false);
    setWinner(null);
    setWinReason("");
    setDrawOffer(null);
    setDialog(null);
    setResultHidden(false);
    setSelectedSide("w");
  };

  const topColor = flipped ? "w" : "b";
  const bottomColor = flipped ? "b" : "w";

  const renderBar = (color) => {
    const active = turn === color && !gameOver;
    const thinking = aiThinking && turn === color;

    return (
      <div className={`fog-player-bar ${active ? "on-turn" : ""}`}>
        <span className={`p-avatar ${color === "b" ? "ai" : ""}`}>
          {color === "w" ? "♔" : "♚"}
        </span>

        <div className="fog-player-meta">
          <strong>{PLAYERS[color]}</strong>
          <small>
            {color === "w" ? "White" : "Black"}
            {thinking ? " · thinking..." : ""}
          </small>
        </div>

        <span
          className={`fog-clock ${active ? "on" : ""} ${time[color] <= 30 ? "low" : ""}`}
        >
          {fmt(time[color])}
        </span>
      </div>
    );
  };

  return (
    <main className={`fog-page ${altTheme ? "fog-theme-alt" : ""}`}>
      <div className="fog-arena-topbar">
        <button className="fog-back-button" onClick={onBack}>
          <BackIcon />
          <span>Back to modes</span>
        </button>

        <div className="fog-mode-heading">
          <span className="fog-mode-indicator" />
          <div>
            <strong>Fog of War</strong>
            <small>Limited vision chess</small>
          </div>
        </div>

        <div className="fog-live-label">
          <span />
          {gameMode === "ai" ? "VS VECTORCHECK" : "LOCAL MATCH"}
        </div>
      </div>

      <section className="fog-layout">
        <div className="fog-center-panel">
          {renderBar(topColor)}

          <div className="fog-board-wrapper">
            <Board
              fen={fen}
              flipped={flipped}
              selected={selected}
              targets={targets}
              lastMove={lastMove}
              onSquareClick={handleSquareClick}
              fog
              glow
              visibleSquares={[...visible]}
            />

            {promotion && (
              <div className="promo-overlay">
                <div className="promo-box">
                  <span>Choose promotion piece</span>
                  <div className="promo-row">
                    {["q", "r", "b", "n"].map((piece) => (
                      <button
                        key={piece}
                        onClick={() =>
                          makeTurn(promotion.from, promotion.to, piece)
                        }
                      >
                        {PROMO_GLYPH[turn][piece]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {drawOffer && !gameOver && (
              <div className="fog-dialog-overlay">
                <div className="fog-dialog-card">
                  <div className="fog-dialog-symbol">🤝</div>
                  <span className="fog-result-eyebrow">DRAW OFFER</span>
                  <h3>{PLAYERS[drawOffer.by]} offers a draw</h3>
                  <p>Do you want to end this match as a draw?</p>

                  <div className="fog-dialog-actions">
                    <button
                      className="fog-primary-button"
                      onClick={() => respondToDraw(true)}
                    >
                      Accept Draw
                    </button>
                    <button
                      className="fog-secondary-button"
                      onClick={() => respondToDraw(false)}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              </div>
            )}

            {dialog === "resign" && !gameOver && (
              <div className="fog-dialog-overlay">
                <div className="fog-dialog-card">
                  <div className="fog-dialog-symbol">⚑</div>
                  <span className="fog-result-eyebrow">RESIGN GAME</span>
                  <h3>Are you sure?</h3>
                  <p>
                    {PLAYERS[turn]} will resign and the opponent will win.
                  </p>

                  <div className="fog-dialog-actions">
                    <button
                      className="fog-danger-button"
                      onClick={confirmResign}
                    >
                      Confirm Resign
                    </button>
                    <button
                      className="fog-secondary-button"
                      onClick={() => setDialog(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {renderBar(bottomColor)}

        </div>

        <aside className="fog-side-panel">
          <div className="fog-card status-card">
            <div className="fog-section-heading">
              <span>GAME STATUS</span>
              <span className="fog-status-live">
                {gameOver ? "FINISHED" : "IN PLAY"}
              </span>
            </div>

            <div className="status-line">
              <span className={`turn-dot ${turn}`} />
              <span>
                {gameOver
                  ? "Game completed"
                  : aiThinking
                    ? "VectorCheck is thinking..."
                    : `${PLAYERS[turn]}'s turn`}
              </span>
            </div>

            <div className="status-sub">
              {visible.size} of 64 squares visible · {history.length} moves played
            </div>

            <div className="fog-visibility-meter">
              <div style={{ width: `${(visible.size / 64) * 100}%` }} />
            </div>

            <p className="fog-hint">
              ◈ Only squares visible to your pieces are revealed. Find what you cannot see.
            </p>
          </div>

          <div className="fog-card fog-actions-card">
            <div className="fog-section-heading">
              <span>GAME ACTIONS</span>
              {gameOver && resultHidden && (
                <button type="button" className="fog-mini-link" onClick={() => setResultHidden(false)}>
                  Show result
                </button>
              )}
            </div>

            <div className="fog-actions-main">
              <button
                className="fog-tool fog-tool--danger"
                onClick={() => setDialog("resign")}
                disabled={gameOver || aiThinking}
              >
                <FlagIcon />
                <span>Resign</span>
              </button>

              <button
                className="fog-tool"
                onClick={offerDraw}
                disabled={gameOver || Boolean(drawOffer) || aiThinking}
              >
                <DrawIcon />
                <span>{drawOffer ? "Draw offered" : "Offer draw"}</span>
              </button>
            </div>

            <div className="fog-actions-sub">
              <button
                className="fog-tool"
                onClick={() => (gameOver ? restart() : setDialog("restart"))}
                title="Restart game"
              >
                <RestartIcon />
                <span>Restart</span>
              </button>

              <button
                className={`fog-tool ${autoFlip ? "on" : ""}`}
                onClick={() => setAutoFlip((value) => !value)}
                title="Auto flip board"
                aria-pressed={autoFlip}
              >
                <FlipIcon />
                <span>Auto flip</span>
              </button>

              <button
                className={`fog-tool ${altTheme ? "on" : ""}`}
                onClick={() => setAltTheme((value) => !value)}
                title="Change board theme"
                aria-pressed={altTheme}
              >
                <ThemeIcon />
                <span>Theme</span>
              </button>
            </div>

            {drawOffer && !gameOver && (
            <div className="fog-pending-draw">
              Draw offer pending
              <button onClick={() => respondToDraw(false)}>Cancel offer</button>
            </div>
            )}
          </div>

          <div className="fog-card move-list-card">
            <div className="fog-panel-tabs">
              <button
                className={activeTab === "moves" ? "active" : ""}
                onClick={() => setActiveTab("moves")}
              >
                <Icon>
                  <path d="M8 6h13M8 12h13M8 18h13" />
                  <path d="M3 6h.01M3 12h.01M3 18h.01" />
                </Icon>
                Moves
              </button>

              <button
                className={activeTab === "chat" ? "active" : ""}
                onClick={() => setActiveTab("chat")}
              >
                <ChatIcon />
                Chat
                {chatMessages.length > 1 && (
                  <span className="fog-chat-count">
                    {chatMessages.length - 1}
                  </span>
                )}
              </button>
            </div>

            {activeTab === "moves" ? (
              <>
                <div className="fog-move-summary">
                  <span>MOVE HISTORY</span>
                  <span>{history.length} total</span>
                </div>

                <div className="moves-box" ref={movesRef}>
                  {rows.length === 0 && (
                    <div className="moves-empty">
                      <span>♟</span>
                      <strong>No moves yet</strong>
                      <small>Your moves will appear here.</small>
                    </div>
                  )}

                  {rows.map((row) => (
                    <div key={row.n} className="move-row">
                      <span className="move-no">{row.n}.</span>
                      <span className="move-w">{row.w}</span>
                      <span className="move-b">{row.b || "—"}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="fog-move-summary">
                  <span>MATCH CHAT</span>
                  <span>LOCAL</span>
                </div>

                <div className="fog-chat-messages" ref={chatRef}>
                  {chatMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`fog-chat-message ${
                        message.system ? "system" : ""
                      }`}
                    >
                      {!message.system && (
                        <strong className={message.color}>
                          {message.player}
                        </strong>
                      )}
                      <p>{message.text}</p>
                    </div>
                  ))}
                </div>

                <form className="fog-chat-form" onSubmit={sendMessage}>
                  <input
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    placeholder={
                      gameOver ? "Game has ended" : "Write a message..."
                    }
                    maxLength={180}
                    disabled={gameOver}
                  />
                  <button
                    type="submit"
                    disabled={gameOver || !chatInput.trim()}
                    aria-label="Send message"
                  >
                    <Icon>
                      <path d="m22 2-7 20-4-9-9-4Z" />
                      <path d="M22 2 11 13" />
                    </Icon>
                  </button>
                </form>
              </>
            )}
          </div>
        </aside>
      </section>

      {gameOver && !resultHidden && (
        <div className="fog-dialog-overlay fog-dialog-overlay--page">
          <section className="fog-post-card" data-tone={resultTone} role="dialog" aria-label="Match result">
            <div className="fog-post-top">
              <span>
                {gameMode === "ai" ? `vs VectorCheck · Lv ${aiLevel}` : "Local match"} ·{" "}
                {timeControl.base ? timeControl.label : "No limit"}
              </span>

              <button
                type="button"
                className="fog-tool fog-tool--icon"
                onClick={() => setResultHidden(true)}
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

            <div className="fog-post-stats">
              <div>
                <b>{history.length}</b>
                <small>Moves</small>
              </div>
              <div>
                <b>{fmt(elapsed)}</b>
                <small>Time</small>
              </div>
              <div>
                <b>{captureCount}</b>
                <small>Captures</small>
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
                <button type="button" className="fog-secondary-button" onClick={copyPgn}>
                  Copy PGN
                </button>
                <button type="button" className="fog-secondary-button" onClick={() => setResultHidden(true)}>
                  View board
                </button>
                <button type="button" className="fog-secondary-button" onClick={onBack}>
                  Home
                </button>
              </div>
            </div>

            <p className="fog-status-text" role="status">{copyState}</p>
          </section>
        </div>
      )}

      {dialog === "restart" && !gameOver && (
        <div className="fog-dialog-overlay fog-dialog-overlay--page">
          <div className="fog-dialog-card">
            <div className="fog-dialog-symbol">↻</div>
            <span className="fog-result-eyebrow">RESTART MATCH</span>
            <h3>Start a new game?</h3>
            <p>Your current match and move history will be cleared.</p>

            <div className="fog-dialog-actions">
              <button className="fog-primary-button" onClick={restart}>
                Restart Game
              </button>

              <button
                className="fog-secondary-button"
                onClick={() => setDialog(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}