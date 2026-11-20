
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Chess } from "chess.js";
import Board from "../../Board";
import { supabase } from "../../lib/supabase";
import {
  getGameRoom,
  getGameMoves,
  getCurrentGamePosition,
  submitGameMove,
  performGameAction,
  subscribeToGameMoves,
  subscribeToGameRoom,
} from "./gameRoom";
import "./MultiplayerGame.css";

function getPlayerLabel(room, color, playerId) {
  const id = color === "w" ? room.white_player : room.black_player;

  if (!id) return "Waiting for player";
  return id === playerId ? "You" : "Opponent";
}

function formatMode(value) {
  return String(value || "Classic").replaceAll("-", " ");
}

/* -----------------------------------------
   FOG OF WAR VISIBILITY
------------------------------------------ */

function getFogVisibleSquares(fen, playerColor) {
  const chess = new Chess(fen);
  const board = chess.board();
  const visible = new Set();
  const files = "abcdefgh";

  function addSquare(file, rank) {
    if (file >= 0 && file < 8 && rank >= 1 && rank <= 8) {
      visible.add(`${files[file]}${rank}`);
    }
  }

  function getPiece(file, rank) {
    if (file < 0 || file >= 8 || rank < 1 || rank > 8) {
      return null;
    }

    return board[8 - rank][file];
  }

  function addRay(file, rank, dx, dy) {
    let x = file + dx;
    let y = rank + dy;

    while (x >= 0 && x < 8 && y >= 1 && y <= 8) {
      addSquare(x, y);

      // Vision stops at the first occupied square.
      if (getPiece(x, y)) break;

      x += dx;
      y += dy;
    }
  }

  board.forEach((row, rowIndex) => {
    row.forEach((piece, file) => {
      if (!piece || piece.color !== playerColor) return;

      const rank = 8 - rowIndex;

      // Own pieces are always visible.
      addSquare(file, rank);

      if (piece.type === "p") {
        const direction = playerColor === "w" ? 1 : -1;
        const nextRank = rank + direction;

        // Pawn forward vision.
        if (!getPiece(file, nextRank)) {
          addSquare(file, nextRank);

          const startingRank = playerColor === "w" ? 2 : 7;
          const doubleRank = rank + direction * 2;

          if (
            rank === startingRank &&
            !getPiece(file, doubleRank)
          ) {
            addSquare(file, doubleRank);
          }
        }

        // Pawn diagonal vision.
        addSquare(file - 1, nextRank);
        addSquare(file + 1, nextRank);
      }

      if (piece.type === "n") {
        const jumps = [
          [1, 2],
          [2, 1],
          [2, -1],
          [1, -2],
          [-1, -2],
          [-2, -1],
          [-2, 1],
          [-1, 2],
        ];

        jumps.forEach(([dx, dy]) => {
          addSquare(file + dx, rank + dy);
        });
      }

      if (piece.type === "k") {
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            if (dx !== 0 || dy !== 0) {
              addSquare(file + dx, rank + dy);
            }
          }
        }
      }

      if (piece.type === "r" || piece.type === "q") {
        [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].forEach(([dx, dy]) => {
          addRay(file, rank, dx, dy);
        });
      }

      if (piece.type === "b" || piece.type === "q") {
        [
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ].forEach(([dx, dy]) => {
          addRay(file, rank, dx, dy);
        });
      }
    });
  });

  return [...visible];
}

export default function MultiplayerGame({ roomId, onBack }) {
  const [room, setRoom] = useState(null);
  const [fen, setFen] = useState(new Chess().fen());
  const [moves, setMoves] = useState([]);
  const [selected, setSelected] = useState(null);
  const [lastMove, setLastMove] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [promotionMove, setPromotionMove] = useState(null);
  const [confirmResign, setConfirmResign] = useState(false);

  const chess = useMemo(() => {
    try {
      return new Chess(fen);
    } catch {
      return new Chess();
    }
  }, [fen]);

  const playerColor = room && playerId
    ? room.white_player === playerId
      ? "w"
      : room.black_player === playerId
        ? "b"
        : null
    : null;

  // Detect Fog mode from the room's saved game mode.
  const isFogMode = String(room?.game_mode || "")
    .toLowerCase()
    .replaceAll("_", "-")
    .includes("fog");

  // Each player gets visibility based on their own pieces.
  const visibleSquares = useMemo(() => {
    if (!isFogMode || !playerColor) return [];

    return getFogVisibleSquares(fen, playerColor);
  }, [fen, playerColor, isFogMode]);

  const isMyTurn =
    room?.status === "active" &&
    playerColor &&
    chess.turn() === playerColor;

  const isFinished = room?.status === "completed";

  const drawOfferedByOpponent =
    room?.draw_offer_by && room.draw_offer_by !== playerId;

  const drawOfferedByMe =
    room?.draw_offer_by && room.draw_offer_by === playerId;

  const targets = useMemo(() => {
    if (!selected || !isMyTurn) return [];

    return chess
      .moves({ square: selected, verbose: true })
      .map((move) => move.to);
  }, [chess, selected, isMyTurn]);

  const refreshGame = useCallback(async () => {
    const [
      nextRoom,
      position,
      nextMoves,
      auth,
    ] = await Promise.all([
      getGameRoom(roomId),
      getCurrentGamePosition(roomId),
      getGameMoves(roomId),
      supabase.auth.getUser(),
    ]);

    if (auth.error) throw auth.error;

    setRoom(nextRoom);
    setPlayerId(auth.data.user?.id || null);
    setFen(position.fen);
    setMoves(nextMoves);

    setLastMove(
      position.lastMove
        ? {
            from: position.lastMove.from_square,
            to: position.lastMove.to_square,
          }
        : null
    );

    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    let active = true;

    async function start() {
      try {
        await refreshGame();
      } catch (err) {
        if (active) {
          setError(err.message || "Unable to load game");
          setLoading(false);
        }
      }
    }

    start();

    const unsubscribeMoves = subscribeToGameMoves(
      roomId,
      async () => {
        try {
          const [position, nextMoves, nextRoom] = await Promise.all([
            getCurrentGamePosition(roomId),
            getGameMoves(roomId),
            getGameRoom(roomId),
          ]);

          if (!active) return;

          setFen(position.fen);
          setMoves(nextMoves);
          setRoom(nextRoom);

          setLastMove(
            position.lastMove
              ? {
                  from: position.lastMove.from_square,
                  to: position.lastMove.to_square,
                }
              : null
          );

          setSelected(null);
          setPromotionMove(null);
        } catch (err) {
          if (active) {
            setError(err.message || "Move sync failed");
          }
        }
      }
    );

    const unsubscribeRoom = subscribeToGameRoom(
      roomId,
      async () => {
        try {
          const nextRoom = await getGameRoom(roomId);

          if (active) {
            setRoom(nextRoom);

            if (nextRoom.status !== "active") {
              setSelected(null);
              setPromotionMove(null);
            }
          }
        } catch (err) {
          if (active) {
            setError(err.message || "Room update failed");
          }
        }
      }
    );

    return () => {
      active = false;
      unsubscribeMoves();
      unsubscribeRoom();
    };
  }, [roomId, refreshGame]);

  async function playMove(from, to, promotion = "q") {
    if (!isMyTurn || submitting) return;

    try {
      setSubmitting(true);
      setError("");
      setNotice("");

      const result = await submitGameMove(roomId, {
        from,
        to,
        promotion,
      });

      const [nextRoom, nextMoves, position] = await Promise.all([
        getGameRoom(roomId),
        getGameMoves(roomId),
        getCurrentGamePosition(roomId),
      ]);

      setRoom(nextRoom);
      setMoves(nextMoves);
      setFen(position.fen);

      setLastMove({
        from: result.move.from_square,
        to: result.move.to_square,
      });

      setSelected(null);
      setPromotionMove(null);

      if (result.isCheckmate) {
        setNotice("Checkmate! The final position is ready.");
      } else if (result.isStalemate) {
        setNotice("Stalemate.");
      } else if (result.isDraw) {
        setNotice("The game has reached a draw position.");
      }
    } catch (err) {
      setError(err.message || "Move could not be submitted");

      try {
        await refreshGame();
      } catch {
        // Preserve the original move error.
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleSquareClick(square) {
    if (
      !isMyTurn ||
      submitting ||
      actionLoading ||
      isFinished
    ) {
      return;
    }

    // In Fog mode, ignore clicks on hidden squares.
    if (isFogMode && !visibleSquares.includes(square)) {
      return;
    }

    setError("");
    setNotice("");

    const piece = chess.get(square);

    if (!selected) {
      if (piece && piece.color === playerColor) {
        setSelected(square);
      }
      return;
    }

    if (square === selected) {
      setSelected(null);
      return;
    }

    if (piece && piece.color === playerColor) {
      setSelected(square);
      return;
    }

    const legalMoves = chess
      .moves({ square: selected, verbose: true })
      .filter((move) => move.to === square);

    if (!legalMoves.length) {
      setSelected(null);
      return;
    }

    const promotion = legalMoves.find((move) => move.isPromotion());

    if (promotion) {
      setPromotionMove({ from: selected, to: square });
      return;
    }

    playMove(selected, square);
  }

  async function handleAction(action) {
    if (actionLoading) return;

    try {
      setActionLoading(true);
      setError("");
      setNotice("");

      await performGameAction(roomId, action);

      const nextRoom = await getGameRoom(roomId);
      setRoom(nextRoom);
      setConfirmResign(false);

      const messages = {
        offer_draw: "Draw offer sent to your opponent.",
        accept_draw: "Draw accepted. The game is complete.",
        decline_draw: "Draw offer declined.",
        resign: "You resigned. The game is complete.",
      };

      setNotice(messages[action] || "Game updated.");
    } catch (err) {
      setError(err.message || "Unable to perform this action");
    } finally {
      setActionLoading(false);
    }
  }

  const turnText = useMemo(() => {
    if (!room) return "";

    if (room.status === "waiting") {
      return "Waiting for opponent";
    }

    if (room.status === "completed") {
      return "Game completed";
    }

    if (room.status !== "active") {
      return `Game ${room.status}`;
    }

    if (chess.isCheck()) {
      return chess.turn() === playerColor
        ? "You are in check"
        : "Opponent is in check";
    }

    return isMyTurn ? "Your turn" : "Opponent's turn";
  }, [room, chess, playerColor, isMyTurn]);

  const resultText = useMemo(() => {
    if (!room || room.status !== "completed") return "";

    if (room.termination_reason === "draw_agreed") {
      return "Draw by agreement";
    }

    if (room.termination_reason === "resignation") {
      return room.winner === playerId
        ? "You won — opponent resigned"
        : "You resigned";
    }

    if (room.winner) {
      return room.winner === playerId
        ? "You won!"
        : "Opponent won";
    }

    return "Game completed";
  }, [room, playerId]);

  // Replay the recorded moves to calculate captures correctly.
  const capturedPieces = useMemo(() => {
    const captured = {
      w: [],
      b: [],
    };

    const replay = new Chess();

    for (const recordedMove of moves) {
      try {
        const move = replay.move({
          from: recordedMove.from_square,
          to: recordedMove.to_square,
          promotion: recordedMove.promotion || "q",
        });

        if (move?.captured) {
          captured[move.color].push(move.captured);
        }
      } catch {
        break;
      }
    }

    return captured;
  }, [moves]);

  if (loading) {
    return (
      <div className="multiplayer-loading">
        <div className="arena-loader" />
        <strong>Preparing your arena...</strong>
        <span>Connecting to Qelvaris Online</span>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="multiplayer-loading">
        {error || "Game room not found"}
        <button onClick={onBack}>Go back</button>
      </div>
    );
  }

  if (!playerColor) {
    return (
      <div className="multiplayer-loading">
        You are not a player in this room.
        <button onClick={onBack}>Go back</button>
      </div>
    );
  }

  const opponentColor = playerColor === "w" ? "b" : "w";
  const opponentName = getPlayerLabel(room, opponentColor, playerId);
  const myName = getPlayerLabel(room, playerColor, playerId);

  const renderCaptured = (pieces) => {
    const order = ["q", "r", "b", "n", "p"];
    const glyphs = {
      q: "♛",
      r: "♜",
      b: "♝",
      n: "♞",
      p: "♟",
    };

    return order.flatMap((piece) =>
      Array.from(
        {
          length: pieces.filter((captured) => captured === piece).length,
        },
        (_, index) => (
          <span key={`${piece}-${index}`}>{glyphs[piece]}</span>
        )
      )
    );
  };

  return (
    <main className="multiplayer-game">
      <header className="arena-header">
        <button className="arena-back" onClick={onBack}>
          <span>←</span> Back to games
        </button>

        <div className="arena-brand">
          <span className="arena-brand-mark">♛</span>
          <div>
            <strong>QELVARIS</strong>
            <small>ONLINE ARENA</small>
          </div>
        </div>

        <div className="arena-room">
          <span>ROOM CODE</span>
          <strong>{room.room_code}</strong>
        </div>
      </header>

      <div className="arena-title-row">
        <div>
          <span className="arena-kicker">LIVE MATCH</span>
          <h1>{formatMode(room.game_mode)}</h1>
          <p>
            {isFogMode
              ? "Fog of War · Explore the board through your pieces."
              : room.status === "active"
                ? "A battle of focus, patience and precision."
                : room.status === "waiting"
                  ? "Your arena is ready. Waiting for your opponent."
                  : "This match has ended."}
          </p>
        </div>

        <span className={`arena-live-pill ${room.status}`}>
          <i />
          {room.status === "active"
            ? "LIVE"
            : room.status === "waiting"
              ? "WAITING"
              : "FINISHED"}
        </span>
      </div>

      <section className="arena-layout">
        <div className="arena-board-column">
          <div
            className={`arena-player-card ${
              chess.turn() === opponentColor && room.status === "active"
                ? "is-active"
                : ""
            }`}
          >
            <div className={`arena-avatar ${opponentColor === "w" ? "light" : "dark"}`}>
              {opponentColor === "w" ? "♔" : "♚"}
            </div>

            <div className="arena-player-details">
              <strong>{opponentName}</strong>
              <span>
                {opponentColor === "w" ? "White pieces" : "Black pieces"}
              </span>
            </div>

            <div className="arena-captured">
              {opponentColor === "w"
                ? renderCaptured(capturedPieces.b)
                : renderCaptured(capturedPieces.w)}
            </div>

            <div className="arena-clock">
              <small>OPPONENT</small>
              <strong>--:--</strong>
            </div>
          </div>

          <div className="arena-board-frame">
            <div className="arena-board">
              <Board
                fen={fen}
                flipped={playerColor === "b"}
                lastMove={isFogMode ? null : lastMove}
                selected={selected}
                targets={targets}
                onSquareClick={handleSquareClick}
                showCoords
                fog={isFogMode}
                visibleSquares={visibleSquares}
              />
            </div>

            {submitting && (
              <div className="arena-board-overlay">
                <div className="arena-loader" />
                <span>Syncing move...</span>
              </div>
            )}
          </div>

          <div
            className={`arena-player-card ${
              chess.turn() === playerColor && room.status === "active"
                ? "is-active"
                : ""
            }`}
          >
            <div className={`arena-avatar ${playerColor === "w" ? "light" : "dark"}`}>
              {playerColor === "w" ? "♔" : "♚"}
            </div>

            <div className="arena-player-details">
              <strong>{myName}</strong>
              <span>
                {playerColor === "w" ? "White pieces" : "Black pieces"} · You
              </span>
            </div>

            <div className="arena-captured">
              {playerColor === "w"
                ? renderCaptured(capturedPieces.w)
                : renderCaptured(capturedPieces.b)}
            </div>

            <div className="arena-clock">
              <small>YOUR CLOCK</small>
              <strong>--:--</strong>
            </div>
          </div>

          <div className="arena-board-tools">
            <span>
              <i className="arena-turn-dot" />
              {turnText}
            </span>

            <span>{moves.length} half-moves played</span>
          </div>

          {isFogMode && (
            <div className="arena-inline-notice">
              <strong>Fog of War active</strong>
              <span>
                Hidden squares are outside your current vision.
              </span>
            </div>
          )}
        </div>

        <aside className="arena-sidebar">
          <section className="arena-panel arena-status-panel">
            <div className="arena-panel-heading">
              <div>
                <span className="arena-kicker">MATCH CONTROL</span>
                <h2>{turnText}</h2>
              </div>

              <span className="arena-status-icon">♟</span>
            </div>

            {isFinished ? (
              <div className="arena-result">
                <span className="arena-result-icon">♛</span>
                <strong>{resultText}</strong>
                <small>
                  {room.termination_reason?.replaceAll("_", " ") || "Match finished"}
                </small>
              </div>
            ) : room.status === "waiting" ? (
              <p className="arena-muted">
                Your opponent needs to join before the match can begin.
              </p>
            ) : (
              <p className="arena-muted">
                {isMyTurn
                  ? "It's your move. Choose a piece and a legal destination."
                  : "Your opponent is thinking. Their next move will appear here automatically."}
              </p>
            )}

            {drawOfferedByOpponent && !isFinished && (
              <div className="arena-draw-notice">
                <strong>Opponent offers a draw</strong>

                <div className="arena-action-pair">
                  <button
                    className="arena-primary-btn"
                    disabled={actionLoading}
                    onClick={() => handleAction("accept_draw")}
                  >
                    Accept
                  </button>

                  <button
                    className="arena-secondary-btn"
                    disabled={actionLoading}
                    onClick={() => handleAction("decline_draw")}
                  >
                    Decline
                  </button>
                </div>
              </div>
            )}

            {drawOfferedByMe && !isFinished && (
              <div className="arena-inline-notice">
                Draw offer sent · Waiting for opponent
              </div>
            )}

            {room.status === "active" && (
              <div className="arena-controls">
                {!drawOfferedByMe && !drawOfferedByOpponent && (
                  <button
                    className="arena-secondary-btn"
                    disabled={actionLoading}
                    onClick={() => handleAction("offer_draw")}
                  >
                    ♙ Offer draw
                  </button>
                )}

                <button
                  className="arena-danger-btn"
                  disabled={actionLoading}
                  onClick={() => setConfirmResign(true)}
                >
                  ⚑ Resign
                </button>
              </div>
            )}

            {confirmResign && (
              <div className="arena-confirm">
                <strong>Resign this game?</strong>
                <span>Your opponent will win this match.</span>

                <div className="arena-action-pair">
                  <button
                    className="arena-danger-btn"
                    disabled={actionLoading}
                    onClick={() => handleAction("resign")}
                  >
                    Confirm resign
                  </button>

                  <button
                    className="arena-secondary-btn"
                    onClick={() => setConfirmResign(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="arena-panel arena-history-panel">
            <div className="arena-panel-heading">
              <div>
                <span className="arena-kicker">GAME RECORD</span>
                <h2>Move history</h2>
              </div>

              <span className="arena-move-count">{moves.length}</span>
            </div>

            <div className="arena-history-list">
              {moves.length === 0 ? (
                <div className="arena-empty-history">
                  <span>♞</span>
                  <strong>No moves yet</strong>
                  <small>The first move starts the battle.</small>
                </div>
              ) : (
                moves.map((move, index) => (
                  <div
                    className="arena-history-row"
                    key={move.id || `${move.move_number}-${move.san}`}
                  >
                    <span className="arena-move-number">
                      {Math.floor(index / 2) + 1}.
                    </span>

                    <strong className={index % 2 === 0 ? "white-move" : ""}>
                      {index % 2 === 0 ? move.san : ""}
                    </strong>

                    <strong className={index % 2 === 1 ? "black-move" : ""}>
                      {index % 2 === 1 ? move.san : ""}
                    </strong>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="arena-panel arena-details-panel">
            <span className="arena-kicker">MATCH DETAILS</span>

            <div className="arena-detail-row">
              <span>Format</span>
              <strong>{formatMode(room.game_mode)}</strong>
            </div>

            <div className="arena-detail-row">
              <span>Time control</span>
              <strong>{room.time_control || "Not set"}</strong>
            </div>

            <div className="arena-detail-row">
              <span>Your colour</span>
              <strong>{playerColor === "w" ? "White" : "Black"}</strong>
            </div>

            <div className="arena-detail-row">
              <span>Moves played</span>
              <strong>{moves.length}</strong>
            </div>
          </section>

          {error && (
            <div className="arena-message error" role="alert">
              {error}
            </div>
          )}

          {notice && (
            <div className="arena-message success" role="status">
              {notice}
            </div>
          )}

          {isFinished && (
            <button
              className="arena-primary-btn arena-back-games"
              onClick={onBack}
            >
              Back to games
            </button>
          )}
        </aside>
      </section>

      {promotionMove && (
        <div className="arena-modal-backdrop">
          <div className="arena-modal">
            <span className="arena-kicker">PROMOTION</span>
            <h2>Choose your piece</h2>
            <p>Promote your pawn to one of these pieces.</p>

            <div className="arena-promotion-options">
              {[
                ["q", "♛", "Queen"],
                ["r", "♜", "Rook"],
                ["b", "♝", "Bishop"],
                ["n", "♞", "Knight"],
              ].map(([piece, symbol, label]) => (
                <button
                  key={piece}
                  onClick={() =>
                    playMove(
                      promotionMove.from,
                      promotionMove.to,
                      piece
                    )
                  }
                >
                  <span>{symbol}</span>
                  <small>{label}</small>
                </button>
              ))}
            </div>

            <button
              className="arena-secondary-btn"
              onClick={() => setPromotionMove(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {actionLoading && (
        <div className="arena-action-loading">
          Updating match...
        </div>
      )}
    </main>
  );
}
