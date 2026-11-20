import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BitBoard from "../../BitBoard";

import {
  createInitialBoard,
  getLegalMoves,
  applyMove,
  getStatus,
  boardToFen,
  pickGlitch,
  applyGlitch,
  ghostsFor,
} from "./bitflipEngine.js";

import { chooseAiMove } from "./bitflipAI.js";

import "./BitFlip.css";

const GLITCH_EVERY = 8;
const GLITCH_DELAY = 750;

const TIME_OPTIONS = [
  { id: "1+0", label: "1 min", base: 60, inc: 0 },
  { id: "3+2", label: "3+2", base: 180, inc: 2 },
  { id: "5+0", label: "5 min", base: 300, inc: 0 },
  { id: "10+0", label: "10 min", base: 600, inc: 0 },
  { id: "15+10", label: "15+10", base: 900, inc: 10 },
  { id: "none", label: "No limit", base: null, inc: 0 },
];

const AI_LEVELS = ["Beginner", "Easy", "Medium", "Hard", "Master"];

const AI_LEVEL_HINTS = [
  "Level 1 plays random moves. Good for learning the glitch.",
  "Level 2 grabs pieces but makes plenty of mistakes.",
  "Level 3 looks 2 moves ahead and avoids simple blunders.",
  "Level 4 looks 3 moves ahead and rarely blunders.",
  "Level 5 searches deep (about 2 sec per move). A tough opponent.",
];

const LETTER = { p: "", n: "N", b: "B", r: "R", q: "Q", k: "K" };

function opposite(color) {
  return color === "w" ? "b" : "w";
}

function formatTime(seconds) {
  if (seconds === Infinity) return "∞";

  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const remaining = safe % 60;

  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

function moveLabel(item) {
  return `${LETTER[item.piece] || ""}${item.from}${item.captured ? "x" : "-"}${item.to}`;
}

function MatrixRain() {
  const columns = Array.from({ length: 18 }, (_, index) => ({
    id: index,
    left: `${(index / 18) * 100}%`,
    delay: `${Math.random() * 7}s`,
    duration: `${7 + Math.random() * 8}s`,
  }));

  return (
    <div className="bf-rain" aria-hidden="true">
      {columns.map((column) => (
        <span
          key={column.id}
          style={{
            left: column.left,
            animationDelay: column.delay,
            animationDuration: column.duration,
          }}
        >
          01 10 11 00 10 01 11 00
        </span>
      ))}
    </div>
  );
}

function PlayerCard({
  name,
  color,
  active,
  time,
  avatar,
  label,
}) {
  return (
    <div className={`bf-player ${active ? "is-active" : ""}`}>
      <div className="bf-player-avatar">{avatar}</div>

      <div className="bf-player-info">
        <div className="bf-player-name">{name}</div>

        <div className="bf-player-label">
          <span
            className={`bf-color-dot ${color === "w" ? "white" : "black"}`}
          />
          {label}
        </div>
      </div>

      <div className={`bf-timer ${active ? "timer-active" : ""}`}>
        {formatTime(time)}
      </div>
    </div>
  );
}

function SetupScreen({
  gameMode,
  setGameMode,
  selectedSide,
  setSelectedSide,
  timeId,
  setTimeId,
  aiLevel,
  setAiLevel,
  onStart,
  onBack,
}) {
  const timeControl =
    TIME_OPTIONS.find((option) => option.id === timeId) || TIME_OPTIONS[2];

  const sides = [
    { id: "w", label: "WHITE", piece: "♔", cls: "white-piece" },
    { id: "random", label: "RANDOM", piece: "?", cls: "random-piece" },
    { id: "b", label: "BLACK", piece: "♚", cls: "black-piece" },
  ];

  return (
    <div className="bf-setup">
      <div className="bf-setup-card">
        <div className="bf-setup-kicker">BITFLIP PROTOCOL // 01</div>

        <div className="bf-setup-symbol">♞</div>

        <h1>
          BITFLIP <span>CHESS</span>
        </h1>

        <p className="bf-setup-description">
          Enter the grid. Make your moves. Survive the glitch.
        </p>

        <div className="bf-tabs" role="tablist">
          {[
            { id: "ai", label: "VS AI" },
            { id: "friend", label: "FRIEND" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              className="bf-tab"
              aria-selected={gameMode === tab.id}
              onClick={() => setGameMode(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {gameMode === "ai" && (
          <div className="bf-setup-section">
            <div className="bf-setup-label">PLAY AS</div>

            <div className="bf-color-choice bf-color-choice--3">
              {sides.map((side) => (
                <button
                  key={side.id}
                  type="button"
                  className={`bf-color-option ${selectedSide === side.id ? "selected" : ""}`}
                  onClick={() => setSelectedSide(side.id)}
                >
                  <span className={`bf-large-piece ${side.cls}`}>
                    {side.piece}
                  </span>
                  <strong>{side.label}</strong>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="bf-setup-section">
          <div className="bf-setup-label">TIME</div>

          <div className="bf-chips">
            {TIME_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className="bf-chip"
                aria-pressed={timeId === option.id}
                onClick={() => setTimeId(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {gameMode === "ai" ? (
          <div className="bf-setup-section bf-level-box">
            <div className="bf-level-row">
              <span className="bf-setup-label">AI LEVEL</span>
              <strong>
                {aiLevel} · {AI_LEVELS[aiLevel - 1].toUpperCase()}
              </strong>
            </div>

            <input
              type="range"
              className="bf-range"
              min="1"
              max="5"
              value={aiLevel}
              onChange={(event) => setAiLevel(Number(event.target.value))}
              aria-label="AI level"
            />

            <p className="bf-level-hint">{AI_LEVEL_HINTS[aiLevel - 1]}</p>
          </div>
        ) : (
          <div className="bf-local-note">
            <span>♟</span>

            <div>
              <strong>LOCAL TWO-PLAYER MODE</strong>
              <small>Player 1 uses White. Player 2 uses Black.</small>
            </div>
          </div>
        )}

        <button
          type="button"
          className="bf-start-button"
          onClick={onStart}
        >
          START BITFLIP <span>→</span>
        </button>

        <div className="bf-setup-footer">
          {gameMode === "ai" ? `AI LEVEL ${aiLevel}` : "LOCAL MATCH"}{" "}
          <span>•</span> {timeControl.base ? timeControl.label.toUpperCase() : "NO LIMIT"}{" "}
          <span>•</span> GLITCH MODE ENABLED
        </div>

        {onBack && (
          <button type="button" className="bf-link-button" onClick={onBack}>
            ← BACK TO GAME MODES
          </button>
        )}
      </div>
    </div>
  );
}

export default function BitFlip({ onBack }) {
  const [phase, setPhase] = useState("setup");
  const [gameMode, setGameMode] = useState("ai");
  const [playerColor, setPlayerColor] = useState("w");
  const [selectedSide, setSelectedSide] = useState("w");
  const [timeId, setTimeId] = useState("5+0");
  const [aiLevel, setAiLevel] = useState(3);

  const timeControl =
    TIME_OPTIONS.find((option) => option.id === timeId) || TIME_OPTIONS[2];

  const startSecs = timeControl.base ?? Infinity;

  const [elapsed, setElapsed] = useState(0);
  const [resultHidden, setResultHidden] = useState(false);
  const [swapColors, setSwapColors] = useState(true);
  const [copyState, setCopyState] = useState("");

  const [board, setBoard] = useState(() => createInitialBoard());
  const [turn, setTurn] = useState("w");
  const [selected, setSelected] = useState(null);
  const [lastMove, setLastMove] = useState(null);

  const [enPassant, setEnPassant] = useState(null);

  const [castling, setCastling] = useState({
    wK: true,
    wQ: true,
    bK: true,
    bQ: true,
  });

  const [winner, setWinner] = useState(null);
  const [winReason, setWinReason] = useState("");

  const [promotion, setPromotion] = useState(null);
  const [history, setHistory] = useState([]);
  const [plies, setPlies] = useState(0);

  const [time, setTime] = useState({
    w: 300,
    b: 300,
  });

  const [lost, setLost] = useState({
    w: [],
    b: [],
  });

  const [glitchSquares, setGlitchSquares] = useState([]);
  const [ghosts, setGhosts] = useState([]);
  const [glitching, setGlitching] = useState(false);
  const [pendingGlitch, setPendingGlitch] = useState(false);
  const [autoFlip, setAutoFlip] = useState(true);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [drawOffer, setDrawOffer] = useState(null);
  const [notice, setNotice] = useState("");

  const glitchTimer = useRef(null);
  const aiTimer = useRef(null);
  const noticeTimer = useRef(null);
  const visualTimer = useRef(null);

  const fen = useMemo(() => boardToFen(board), [board]);

  const positionStatus = useMemo(
    () => getStatus(board, turn, enPassant, castling),
    [board, turn, enPassant, castling]
  );

  const playerNames = useMemo(() => {
    if (gameMode === "friend") {
      return {
        w: "Player 1",
        b: "Player 2",
      };
    }

    return playerColor === "w"
      ? {
          w: "You",
          b: "BitFlip AI",
        }
      : {
          w: "BitFlip AI",
          b: "You",
        };
  }, [gameMode, playerColor]);

  const isAiTurn =
    phase === "playing" &&
    gameMode === "ai" &&
    turn !== playerColor &&
    !winner &&
    !promotion &&
    !pendingGlitch;

  const legalTargets = useMemo(() => {
    if (
      !selected ||
      phase !== "playing" ||
      pendingGlitch
    ) {
      return [];
    }

    return getLegalMoves(
      board,
      selected,
      enPassant,
      castling
    );
  }, [
    board,
    selected,
    enPassant,
    castling,
    phase,
    pendingGlitch,
  ]);

  const showNotice = useCallback((message) => {
    setNotice(message);

    if (noticeTimer.current) {
      clearTimeout(noticeTimer.current);
    }

    noticeTimer.current = setTimeout(() => {
      setNotice("");
    }, 2600);
  }, []);

  const finishGame = useCallback((winningSide, reason) => {
    setWinner(winningSide);
    setWinReason(reason);
    setPhase("over");
    setPendingGlitch(false);
    setPromotion(null);
    setSelected(null);

    if (glitchTimer.current) {
      clearTimeout(glitchTimer.current);
    }

    if (aiTimer.current) {
      clearTimeout(aiTimer.current);
    }

    if (visualTimer.current) {
      clearTimeout(visualTimer.current);
    }
  }, []);

  const checkGameResult = useCallback(
    (nextBoard, nextTurn, nextEnPassant, nextCastling) => {
      const status = getStatus(
        nextBoard,
        nextTurn,
        nextEnPassant,
        nextCastling
      );

      if (status.state === "checkmate") {
        finishGame(
          opposite(nextTurn),
          `${playerNames[nextTurn]} is checkmated`
        );
        return true;
      }

      if (status.state === "stalemate") {
        finishGame("draw", "STALEMATE");
        return true;
      }

      if (status.state === "draw") {
        finishGame(
          "draw",
          "DRAW — " + (status.reason || "CHESS RULES")
        );
        return true;
      }

      return false;
    },
    [finishGame, playerNames]
  );

  const startGame = (forcedSide) => {
    const pick = typeof forcedSide === "string" ? forcedSide : selectedSide;

    const finalSide =
      pick === "random" ? (Math.random() < 0.5 ? "w" : "b") : pick;

    setPlayerColor(finalSide);
    setElapsed(0);
    setResultHidden(false);
    setCopyState("");

    if (glitchTimer.current) clearTimeout(glitchTimer.current);
    if (aiTimer.current) clearTimeout(aiTimer.current);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    if (visualTimer.current) clearTimeout(visualTimer.current);

    setBoard(createInitialBoard());
    setTurn("w");
    setSelected(null);
    setLastMove(null);

    setEnPassant(null);

    setCastling({
      wK: true,
      wQ: true,
      bK: true,
      bQ: true,
    });

    setWinner(null);
    setWinReason("");
    setPromotion(null);
    setHistory([]);
    setPlies(0);

    setTime({
      w: startSecs,
      b: startSecs,
    });

    setLost({
      w: [],
      b: [],
    });

    setGlitchSquares([]);
    setGhosts([]);
    setGlitching(false);
    setPendingGlitch(false);

    setChatMessages([]);
    setDrawOffer(null);
    setNotice("");

    setPhase("playing");
  };

  const restart = () => {
    startGame(playerColor);
  };

  const rematch = () => {
    startGame(
      gameMode === "ai" && swapColors ? opposite(playerColor) : playerColor
    );
  };

  const newGame = () => {
    if (glitchTimer.current) clearTimeout(glitchTimer.current);
    if (aiTimer.current) clearTimeout(aiTimer.current);
    if (visualTimer.current) clearTimeout(visualTimer.current);

    setPhase("setup");
    setWinner(null);
    setWinReason("");
    setPendingGlitch(false);
    setPromotion(null);
    setSelected(null);
    setDrawOffer(null);
    setResultHidden(false);
  };

  /*
   * CLOCK
   */
  useEffect(() => {
    if (
      phase !== "playing" ||
      winner ||
      pendingGlitch ||
      promotion
    ) {
      return undefined;
    }

    const timer = setInterval(() => {
      setElapsed((value) => value + 1);

      setTime((current) => {
        if (current[turn] === Infinity) return current;

        if (current[turn] <= 1) {
          const next = {
            ...current,
            [turn]: 0,
          };

          setTimeout(() => {
            finishGame(opposite(turn), "TIME OUT");
          }, 0);

          return next;
        }

        return {
          ...current,
          [turn]: current[turn] - 1,
        };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [
    phase,
    turn,
    winner,
    pendingGlitch,
    promotion,
    finishGame,
  ]);

  /*
   * GLITCH PROCESS
   *
   * Glitch ke baad updated board par legal chess status
   * dobara calculate hota hai.
   */
  useEffect(() => {
    if (!pendingGlitch || phase !== "playing" || winner) {
      return undefined;
    }

    glitchTimer.current = setTimeout(() => {
      const pair = pickGlitch(board);

      if (!pair) {
        setPendingGlitch(false);

        checkGameResult(
          board,
          turn,
          enPassant,
          castling
        );

        return;
      }

      const before = { ...board };

      const result = applyGlitch(
        board,
        castling,
        pair
      );

      if (!result?.board) {
        setPendingGlitch(false);
        showNotice("GRID SHIFT FAILED");
        return;
      }

      setBoard(result.board);
      setCastling(result.castling);
      setEnPassant(null);

      setGlitchSquares(pair);
      setGhosts(ghostsFor(before, pair));

      setHistory((current) => [
        ...current,
        {
          type: "glitch",
          text: `GRID SHIFT: ${pair[0]} ↔ ${pair[1]}`,
          ply: plies,
        },
      ]);

      setGlitching(true);
      setPendingGlitch(false);

      const ended = checkGameResult(
        result.board,
        turn,
        null,
        result.castling
      );

      showNotice(
        ended
          ? "GRID SHIFT COMPLETE"
          : "GRID SHIFT COMPLETE — POSITION VALIDATED"
      );

      visualTimer.current = setTimeout(() => {
        setGlitching(false);
        setGlitchSquares([]);
        setGhosts([]);
      }, 1000);
    }, GLITCH_DELAY);

    return () => {
      if (glitchTimer.current) {
        clearTimeout(glitchTimer.current);
      }
    };
  }, [
    pendingGlitch,
    phase,
    winner,
    board,
    turn,
    enPassant,
    castling,
    plies,
    checkGameResult,
    showNotice,
  ]);

  /*
   * STANDARD CHESS MOVE
   *
   * applyMove() engine ke andar legal move verify karta hai.
   * Illegal move par null return hota hai aur board update nahi hota.
   */
  const makeTurn = useCallback(
    (from, to, promotionPiece = "q") => {
      if (
        phase !== "playing" ||
        winner ||
        pendingGlitch
      ) {
        return;
      }

      const movingPiece = board[from];

      if (!movingPiece || movingPiece.color !== turn) {
        return;
      }

      const result = applyMove(
        board,
        from,
        to,
        enPassant,
        castling,
        promotionPiece
      );

      if (!result?.board) {
        showNotice("ILLEGAL MOVE — KING SAFETY RULE");
        setSelected(null);
        return;
      }

      const nextPly = plies + 1;
      const nextTurn = opposite(turn);
      const capturedPiece = result.captured;

      setBoard(result.board);
      setCastling(result.castling);
      setEnPassant(result.enPassant);
      setLastMove({ from, to });
      setSelected(null);
      setPromotion(null);

      if (capturedPiece) {
        setLost((current) => ({
          ...current,
          [capturedPiece.color]: [
            ...current[capturedPiece.color],
            capturedPiece.type,
          ],
        }));
      }

      setPlies(nextPly);

      if (timeControl.inc && timeControl.base !== null) {
        setTime((current) => ({
          ...current,
          [turn]: current[turn] + timeControl.inc,
        }));
      }

      setHistory((current) => [
        ...current,
        {
          type: "move",
          from,
          to,
          piece: movingPiece.type,
          color: turn,
          captured: capturedPiece || null,
          ply: nextPly,
          san: `${from} → ${to}`,
        },
      ]);

      setTurn(nextTurn);

      const ended = checkGameResult(
        result.board,
        nextTurn,
        result.enPassant,
        result.castling
      );

      if (ended) return;

      if (nextPly % GLITCH_EVERY === 0) {
        setPendingGlitch(true);
        showNotice("WARNING: GRID DESTABILIZATION DETECTED");
      }
    },
    [
      phase,
      winner,
      pendingGlitch,
      board,
      turn,
      enPassant,
      castling,
      plies,
      timeControl,
      checkGameResult,
      showNotice,
    ]
  );

  /*
   * BOARD INPUT
   */
  const handleSquareClick = (square) => {
    if (
      phase !== "playing" ||
      winner ||
      pendingGlitch ||
      promotion
    ) {
      return;
    }

    if (gameMode === "ai" && turn !== playerColor) {
      return;
    }

    const piece = board[square];

    if (selected) {
      const legalMoves = getLegalMoves(
        board,
        selected,
        enPassant,
        castling
      );

      const chosen = legalMoves.includes(square);

      if (chosen) {
        const selectedPiece = board[selected];
        const promotionRank =
          selectedPiece?.color === "w" ? "8" : "1";

        if (
          selectedPiece?.type === "p" &&
          square[1] === promotionRank
        ) {
          setPromotion({
            from: selected,
            to: square,
          });

          return;
        }

        makeTurn(selected, square);
        return;
      }
    }

    if (piece && piece.color === turn) {
      const moves = getLegalMoves(
        board,
        square,
        enPassant,
        castling
      );

      if (moves.length) {
        setSelected(square);
      } else {
        setSelected(null);
      }
    } else {
      setSelected(null);
    }
  };

  /*
   * AI — SAME LEGAL ENGINE AS HUMAN
   */
  useEffect(() => {
    if (!isAiTurn) return undefined;

    aiTimer.current = setTimeout(() => {
      const move = chooseAiMove(
        board,
        turn,
        enPassant,
        castling,
        aiLevel
      );

      if (!move) {
        const status = getStatus(
          board,
          turn,
          enPassant,
          castling
        );

        if (status.state === "checkmate") {
          finishGame(playerColor, "CHECKMATE");
        } else if (status.state === "stalemate") {
          finishGame("draw", "STALEMATE");
        } else {
          finishGame("draw", "DRAW");
        }

        return;
      }

      makeTurn(
        move.from,
        move.to,
        move.promotion || "q"
      );
    }, aiLevel >= 4 ? 350 : 650);

    return () => {
      if (aiTimer.current) {
        clearTimeout(aiTimer.current);
      }
    };
  }, [
    isAiTurn,
    board,
    turn,
    enPassant,
    castling,
    makeTurn,
    finishGame,
    playerColor,
    aiLevel,
  ]);

  /*
   * ACTIONS
   */
  const resign = () => {
    if (phase !== "playing" || winner) return;

    finishGame(
      opposite(turn),
      `${playerNames[turn]} RESIGNED`
    );
  };

  const offerDraw = () => {
    if (phase !== "playing" || winner || drawOffer) return;

    setDrawOffer(turn);
    showNotice(`${playerNames[turn]} offered a draw`);
  };

  const answerDraw = (accepted) => {
    if (accepted) {
      finishGame("draw", "DRAW AGREED");
    } else {
      showNotice("Draw offer declined");
    }

    setDrawOffer(null);
  };

  const sendChat = (event) => {
    event.preventDefault();

    const message = chatInput.trim();

    if (!message) return;

    setChatMessages((current) => [
      ...current,
      {
        id: `${Date.now()}-${Math.random()}`,
        sender:
          gameMode === "friend"
            ? playerNames[turn]
            : "You",
        message,
      },
    ]);

    setChatInput("");
  };

  const flipped =
    gameMode === "ai"
      ? playerColor === "b"
      : autoFlip && turn === "b";

  const moveRows = history;

  const moveCount = history.filter((item) => item.type === "move").length;
  const glitchCount = history.filter((item) => item.type === "glitch").length;
  const captureCount = history.filter(
    (item) => item.type === "move" && item.captured
  ).length;

  const leftColor = gameMode === "ai" ? playerColor : "w";
  const rightColor = opposite(leftColor);

  const scoreOf = (color) =>
    winner === "draw" ? "½" : winner === color ? "1" : "0";

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
      ? "DRAW"
      : gameMode === "ai"
        ? winner === playerColor
          ? "YOU WON"
          : "YOU LOST"
        : `${(playerNames[winner] || "").toUpperCase()} WINS`;

  const copyLog = async () => {
    const result =
      winner === "draw"
        ? "1/2-1/2"
        : winner === "w"
          ? "1-0"
          : winner === "b"
            ? "0-1"
            : "*";

    const head = [
      `[Event "Qelvaris BitFlip Chess"]`,
      `[White "${playerNames.w}"]`,
      `[Black "${playerNames.b}"]`,
      `[Result "${result}"]`,
      `[Note "Grid shift every ${GLITCH_EVERY} plies. Not standard PGN."]`,
    ].join("\n");

    const body = history
      .map((item) =>
        item.type === "glitch"
          ? `{${item.text}}`
          : item.color === "w"
            ? `${Math.ceil(item.ply / 2)}. ${moveLabel(item)}`
            : moveLabel(item)
      )
      .join(" ");

    try {
      await navigator.clipboard.writeText(`${head}\n\n${body} ${result}`);
      setCopyState("MOVE LOG COPIED");
    } catch {
      setCopyState("COULD NOT COPY");
    }
  };

  if (phase === "setup") {
    return (
      <div className="bf-page">
        <MatrixRain />

        <SetupScreen
          gameMode={gameMode}
          setGameMode={setGameMode}
          selectedSide={selectedSide}
          setSelectedSide={setSelectedSide}
          timeId={timeId}
          setTimeId={setTimeId}
          aiLevel={aiLevel}
          setAiLevel={setAiLevel}
          onStart={() => startGame()}
          onBack={onBack}
        />
      </div>
    );
  }

  return (
    <div className="bf-page">
      <MatrixRain />

      <header className="bf-header">
        <div className="bf-logo">
          <span className="bf-logo-mark">♞</span>
          <span>
            BITFLIP <b>CHESS</b>
          </span>
        </div>

        <div className="bf-header-status">
          <span className="bf-live-dot" />
          {phase === "over" ? "SESSION ENDED" : "SYSTEM ONLINE"}
        </div>

        <button
          type="button"
          className="bf-exit-button"
          onClick={() => {
            if (glitchTimer.current) clearTimeout(glitchTimer.current);
            if (aiTimer.current) clearTimeout(aiTimer.current);
            if (visualTimer.current) clearTimeout(visualTimer.current);

            setPhase("setup");
            setWinner(null);
            setPendingGlitch(false);
            setPromotion(null);
            setSelected(null);
          }}
        >
          EXIT MODE
        </button>
      </header>

      <main className="bf-layout">
        <aside className="bf-left">
          <div className="bf-card bf-match-card">
            <div className="bf-card-heading">MATCH SESSION</div>

            <div className="bf-session-mode">
              {gameMode === "ai" ? "AI BATTLE" : "LOCAL MULTIPLAYER"}
            </div>

            <div className="bf-session-sub">
              {gameMode === "ai"
                ? `Human vs BitFlip AI · Level ${aiLevel}`
                : "Two players · Same device"}
            </div>

            <div className="bf-session-line">
              <span>PROTOCOL</span>
              <strong>GLITCH-08</strong>
            </div>

            <div className="bf-session-line">
              <span>GLITCH INTERVAL</span>
              <strong>4 MOVES / PLAYER</strong>
            </div>
          </div>

          <div className="bf-card">
            <div className="bf-card-heading">PLAYERS</div>

            <PlayerCard
              name={playerNames.w}
              color="w"
              active={turn === "w" && phase === "playing"}
              time={time.w}
              avatar={
                gameMode === "ai" && playerColor === "b"
                  ? "⌘"
                  : "♔"
              }
              label="WHITE"
            />

            <PlayerCard
              name={playerNames.b}
              color="b"
              active={turn === "b" && phase === "playing"}
              time={time.b}
              avatar={
                gameMode === "ai" && playerColor === "w"
                  ? "⌘"
                  : "♚"
              }
              label="BLACK"
            />
          </div>

          <div className="bf-card bf-glitch-card">
            <div className="bf-card-heading">GRID STABILITY</div>

            <div className="bf-glitch-number">
              {Math.floor(plies / GLITCH_EVERY)}
            </div>

            <div className="bf-glitch-caption">
              GLITCH EVENTS TRIGGERED
            </div>

            <div className="bf-glitch-progress">
              <span
                style={{
                  width: `${((plies % GLITCH_EVERY) / GLITCH_EVERY) * 100}%`,
                }}
              />
            </div>

            <small>
              {GLITCH_EVERY - (plies % GLITCH_EVERY)} plies until next shift
            </small>
          </div>

          <div className="bf-card bf-turn-card">
            <div className="bf-card-heading">CURRENT TURN</div>

            <div className="bf-turn-name">
              {phase === "over"
                ? "SESSION COMPLETE"
                : pendingGlitch
                  ? "GRID SHIFTING..."
                  : playerNames[turn]}
            </div>

            <div className="bf-turn-sub">
              {phase === "over"
                ? winReason
                : positionStatus.check
                  ? "⚠ CHECK — KING MUST ESCAPE"
                  : `${turn === "w" ? "WHITE" : "BLACK"} TO MOVE`}
            </div>
          </div>
        </aside>

        <section className="bf-center">
          <div className="bf-board-topline">
            <span>SECTOR 08 / LIVE BOARD</span>

            <span
              className={
                glitching || pendingGlitch || positionStatus.check
                  ? "bf-warning-text"
                  : ""
              }
            >
              {positionStatus.check
                ? "⚠ CHECK"
                : glitching || pendingGlitch
                  ? "⚠ GRID INSTABILITY"
                  : "● STABLE"}
            </span>
          </div>

          <div className={`bf-stage ${glitching ? "is-glitching" : ""}`}>
            <div className="bf-board-frame">
              <div className="bf-board-glow" />

              <BitBoard
                fen={fen}
                flipped={flipped}
                selected={selected}
                targets={legalTargets}
                lastMove={lastMove}
                glitch={glitchSquares}
                arrows={[]}
                ghosts={ghosts}
                unstable={pendingGlitch}
                charge={(plies % GLITCH_EVERY) / GLITCH_EVERY}
                showCoords={false}
                onSquareClick={handleSquareClick}
              />

              {pendingGlitch && (
                <div className="bf-board-overlay">
                  <div className="bf-overlay-box">
                    <span className="bf-overlay-icon">⌁</span>
                    <strong>GRID DESTABILIZING</strong>
                    <small>Piece positions may change</small>
                  </div>
                </div>
              )}

              {promotion && (
                <div className="bf-promotion-overlay">
                  <div className="bf-promotion-box">
                    <strong>SELECT PROMOTION</strong>

                    <div className="bf-promotion-options">
                      {["q", "r", "b", "n"].map((piece) => (
                        <button
                          type="button"
                          key={piece}
                          onClick={() =>
                            makeTurn(
                              promotion.from,
                              promotion.to,
                              piece
                            )
                          }
                        >
                          {piece.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>

          {notice && <div className="bf-notice">{notice}</div>}

          <div className="bf-controls">
            <button
              type="button"
              onClick={() => setAutoFlip((value) => !value)}
            >
              ⇅ FLIP BOARD
            </button>

            <button
              type="button"
              onClick={offerDraw}
              disabled={phase !== "playing"}
            >
              ◇ OFFER DRAW
            </button>

            <button
              type="button"
              onClick={() => setChatOpen((value) => !value)}
            >
              ▤ CHAT
            </button>

            <button
              type="button"
              className="bf-resign-button"
              onClick={resign}
              disabled={phase !== "playing"}
            >
              ⚑ RESIGN
            </button>
          </div>
        </section>

        <aside className="bf-right">
          <div className="bf-card bf-log-card">
            <div className="bf-card-heading">
              <span>MOVE HISTORY</span>

              <span className="bf-log-count">
                {history.filter((item) => item.type === "move").length}
              </span>
            </div>

            <div className="bf-log-list">
              {moveRows.length === 0 && (
                <div className="bf-empty-log">
                  Awaiting first move...
                </div>
              )}

              {moveRows.map((item, index) => (
                <div
                  key={`${item.type}-${index}`}
                  className={`bf-log-entry ${
                    item.type === "glitch" ? "glitch-entry" : ""
                  }`}
                >
                  {item.type === "glitch" ? (
                    <>
                      <span className="bf-log-glitch">⌁</span>
                      <span>{item.text}</span>
                    </>
                  ) : (
                    <>
                      <span className="bf-log-number">
                        {Math.ceil(item.ply / 2)}.
                      </span>

                      <span
                        className={`bf-log-piece ${
                          item.color === "w" ? "white-text" : "black-text"
                        }`}
                      >
                        {item.piece.toUpperCase()}
                      </span>

                      <span>
                        {item.san || `${item.from} → ${item.to}`}
                      </span>

                      {item.captured && (
                        <span className="bf-capture-mark">×</span>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bf-card bf-captured-card">
            <div className="bf-card-heading">CAPTURED PIECES</div>

            <div className="bf-captured-row">
              <span>WHITE LOST</span>
              <strong>{lost.w.length}</strong>
            </div>

            <div className="bf-captured-pieces">
              {lost.w.map((piece, index) => (
                <span key={index}>{piece.toUpperCase()}</span>
              ))}
            </div>

            <div className="bf-captured-row">
              <span>BLACK LOST</span>
              <strong>{lost.b.length}</strong>
            </div>

            <div className="bf-captured-pieces">
              {lost.b.map((piece, index) => (
                <span key={index}>{piece.toUpperCase()}</span>
              ))}
            </div>
          </div>

          <div className="bf-card bf-system-card">
            <div className="bf-card-heading">SYSTEM STATUS</div>

            <div className="bf-system-line">
              <span>ENGINE</span>
              <strong>ACTIVE</strong>
            </div>

            <div className="bf-system-line">
              <span>CHESS RULES</span>
              <strong>ENFORCED</strong>
            </div>

            <div className="bf-system-line">
              <span>GLITCH CORE</span>
              <strong>ARMED</strong>
            </div>

            <div className="bf-system-line">
              <span>CONNECTION</span>
              <strong>LOCAL</strong>
            </div>
          </div>
        </aside>
      </main>

      {phase === "over" && !resultHidden && (
        <div className="bf-modal-backdrop">
          <section
            className="bf-post-card"
            data-tone={resultTone}
            role="dialog"
            aria-label="Match result"
          >
            <div className="bf-post-top">
              <span>
                {gameMode === "ai"
                  ? `VS BITFLIP AI · LV ${aiLevel}`
                  : "LOCAL MATCH"}{" "}
                · {timeControl.base ? timeControl.label.toUpperCase() : "NO LIMIT"}
              </span>

              <button
                type="button"
                className="bf-post-close"
                onClick={() => setResultHidden(true)}
                aria-label="Close and view board"
              >
                ×
              </button>
            </div>

            <div className="bf-post-res">
              <h2>{resultTitle}</h2>
              <p>{winReason}</p>
            </div>

            <div className="bf-post-players">
              <div className="bf-post-pl">
                <span className={`bf-post-tile ${leftColor === "w" ? "white-piece" : "black-piece"}`}>
                  {leftColor === "w" ? "♔" : "♚"}
                </span>
                <div>
                  <b>{playerNames[leftColor]}</b>
                  <small>{leftColor === "w" ? "WHITE" : "BLACK"}</small>
                </div>
              </div>

              <span className="bf-post-score">
                {scoreOf(leftColor)} – {scoreOf(rightColor)}
              </span>

              <div className="bf-post-pl bf-post-pl--r">
                <span className={`bf-post-tile ${rightColor === "w" ? "white-piece" : "black-piece"}`}>
                  {rightColor === "w" ? "♔" : "♚"}
                </span>
                <div>
                  <b>{playerNames[rightColor]}</b>
                  <small>{rightColor === "w" ? "WHITE" : "BLACK"}</small>
                </div>
              </div>
            </div>

            <div className="bf-post-stats">
              <div>
                <b>{moveCount}</b>
                <small>MOVES</small>
              </div>
              <div>
                <b>{formatTime(elapsed)}</b>
                <small>TIME</small>
              </div>
              <div>
                <b>{captureCount}</b>
                <small>CAPTURES</small>
              </div>
              <div>
                <b>{glitchCount}</b>
                <small>GLITCHES</small>
              </div>
            </div>

            <button
              type="button"
              className="bf-start-button bf-post-rematch"
              onClick={rematch}
            >
              REMATCH <span>→</span>
            </button>

            {gameMode === "ai" && (
              <label className="bf-swap">
                <input
                  type="checkbox"
                  checked={swapColors}
                  onChange={(event) => setSwapColors(event.target.checked)}
                />
                SWAP COLORS
              </label>
            )}

            <div className="bf-post-grid">
              <button type="button" onClick={newGame}>
                NEW GAME
              </button>

              <button type="button" onClick={copyLog}>
                COPY LOG
              </button>

              <button type="button" onClick={() => setResultHidden(true)}>
                VIEW BOARD
              </button>

              <button type="button" onClick={onBack || newGame}>
                HOME
              </button>
            </div>

            <p className="bf-post-status" role="status">
              {copyState}
            </p>
          </section>
        </div>
      )}

      {drawOffer && phase === "playing" && (
        <div className="bf-modal-backdrop">
          <div className="bf-modal">
            <div className="bf-modal-symbol">◇</div>
            <h2>DRAW OFFER</h2>

            <p>{playerNames[drawOffer]} offered a draw.</p>

            <div className="bf-modal-actions">
              <button
                type="button"
                onClick={() => answerDraw(true)}
              >
                ACCEPT DRAW
              </button>

              <button
                type="button"
                onClick={() => answerDraw(false)}
              >
                DECLINE
              </button>
            </div>
          </div>
        </div>
      )}

      {chatOpen && (
        <div className="bf-chat-panel">
          <div className="bf-chat-header">
            <strong>LOCAL CHAT</strong>

            <button
              type="button"
              onClick={() => setChatOpen(false)}
            >
              ×
            </button>
          </div>

          <div className="bf-chat-messages">
            {chatMessages.length === 0 && (
              <div className="bf-chat-empty">
                No messages yet. Start the conversation.
              </div>
            )}

            {chatMessages.map((message) => (
              <div className="bf-chat-message" key={message.id}>
                <strong>{message.sender}</strong>
                <span>{message.message}</span>
              </div>
            ))}
          </div>

          <form className="bf-chat-form" onSubmit={sendChat}>
            <input
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              placeholder="Type a message..."
              maxLength={180}
            />

            <button type="submit">SEND</button>
          </form>

          <div className="bf-chat-footnote">
            Messages are visible on this device only.
          </div>
        </div>
      )}
    </div>
  );
}