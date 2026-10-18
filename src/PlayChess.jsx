
import { useCallback, useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import "./PlayChess.css";

const ENGINE_URL = "/stockfish/stockfish-19-lite-single.js";
const DEPTH_BY_DIFFICULTY = {
  Easy: 3,
  Medium: 7,
  Hard: 10,
};

const PIECES = {
  w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
  b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" },
};

function makeGame() {
  return new Chess();
}

export default function PlayChess() {
  const gameRef = useRef(makeGame());
  const workerRef = useRef(null);
  const thinkingRef = useRef(false);
  const [difficulty, setDifficulty] = useState("Medium");
 const [saveMessage, setSaveMessage] = useState("");
  const [fen, setFen] = useState(gameRef.current.fen());
  const [selected, setSelected] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [thinking, setThinking] = useState(false);
  const [engineReady, setEngineReady] = useState(false);
  const [lastMove, setLastMove] = useState(null);
  const [history, setHistory] = useState([]);
  const [message, setMessage] = useState("Your move — White plays first");
  const [playerColor, setPlayerColor] = useState("w");

  const syncGame = useCallback(() => {
    const game = gameRef.current;
    setFen(game.fen());
    setHistory(game.history());
    setSelected(null);
    setLegalMoves([]);
    setLastMove(game.history({ verbose: true }).slice(-1)[0] || null);

    if (game.isCheckmate()) {
      setMessage(
        game.turn() === playerColor
          ? "Checkmate — you lost this game."
          : "Checkmate — you won!"
      );
    } else if (game.isDraw()) {
      setMessage("Game drawn.");
    } else if (game.isCheck()) {
      setMessage("Check!");
    } else {
      setMessage(game.turn() === playerColor ? "Your move" : "Computer's turn");
    }
  }, [playerColor]);

  useEffect(() => {
    let worker;

    try {
      worker = new Worker(ENGINE_URL);
      workerRef.current = worker;

      worker.onmessage = (event) => {
        const line = String(event.data || "");

        if (line === "uciok") {
          worker.postMessage("isready");
        }

        if (line === "readyok") {
          setEngineReady(true);
        }

        if (line.startsWith("bestmove")) {
          thinkingRef.current = false;
          setThinking(false);

          const move = line.split(/\s+/)[1];
          const game = gameRef.current;

          if (
            move &&
            move !== "(none)" &&
            !game.isGameOver() &&
            game.turn() !== playerColor
          ) {
            try {
              game.move({
                from: move.slice(0, 2),
                to: move.slice(2, 4),
                promotion: move[4] || "q",
              });
              syncGame();
            } catch (error) {
              console.error("Engine move failed:", error);
            }
          }
        }
      };

      worker.onerror = (error) => {
        console.error("Stockfish worker error:", error);
        setEngineReady(false);
        setMessage("Engine could not start. Check the Stockfish files.");
      };

      worker.postMessage("uci");
    } catch (error) {
      console.error("Could not create Stockfish worker:", error);
      setMessage("Stockfish could not load. Check the engine file path.");
    }

    return () => {
      worker?.terminate();
      workerRef.current = null;
    };
  }, [playerColor, syncGame]);

  const askComputer = useCallback(() => {
    const worker = workerRef.current;
    const game = gameRef.current;

    if (
      !worker ||
      !engineReady ||
      game.isGameOver() ||
      game.turn() === playerColor ||
      thinkingRef.current
    ) {
      return;
    }

    thinkingRef.current = true;
    setThinking(true);
    setMessage("Computer is thinking...");
    worker.postMessage("position fen " + game.fen());
   worker.postMessage(
  `go depth ${DEPTH_BY_DIFFICULTY[difficulty]}`
);
  }, [engineReady, playerColor, difficulty]);

  useEffect(() => {
    if (
      engineReady &&
      !gameRef.current.isGameOver() &&
      gameRef.current.turn() !== playerColor
    ) {
      askComputer();
    }
  }, [fen, engineReady, playerColor, askComputer]);

const saveCurrentGame = () => {
  const game = gameRef.current;
  const savedResult = game.isCheckmate()
    ? game.turn() === "w" ? "0-1" : "1-0"
    : game.isDraw()
      ? "1/2-1/2"
      : "*";

  const savedGame = {
    id: Date.now(),
    date: new Date().toISOString(),
    pgn: game.pgn(),
    result: savedResult,
    moves: game.history(),
    source: "computer",
  };

  try {
    const existing = JSON.parse(
      localStorage.getItem("qelvarisSavedGames") || "[]"
    );

    if (!Array.isArray(existing)) {
      throw new Error("Saved games data is not a list");
    }

    existing.unshift(savedGame);
    localStorage.setItem(
      "qelvarisSavedGames",
      JSON.stringify(existing)
    );

    setSaveMessage("Game saved successfully!");
  } catch (error) {
    console.error("Could not save game:", error);
    setSaveMessage("Could not save game. Please try again.");
  }
};

  const handleSquareClick = (square) => {
    const game = gameRef.current;

    if (
      game.isGameOver() ||
      thinking ||
      game.turn() !== playerColor
    ) {
      return;
    }

    const piece = game.get(square);

    if (selected && legalMoves.includes(square)) {
      try {
        game.move({ from: selected, to: square, promotion: "q" });
        syncGame();
      } catch (error) {
        console.error("Invalid move:", error);
      }
      return;
    }

    if (piece && piece.color === playerColor) {
      setSelected(square);
      setLegalMoves(
        game.moves({ square, verbose: true }).map((move) => move.to)
      );
    } else {
      setSelected(null);
      setLegalMoves([]);
    }
  };

  const newGame = () => {
    thinkingRef.current = false;
    setThinking(false);
    gameRef.current = makeGame();
    setFen(gameRef.current.fen());
    setHistory([]);
    setSelected(null);
    setLegalMoves([]);
    setLastMove(null);
    setMessage("Your move — White plays first");

    if (workerRef.current) {
      workerRef.current.postMessage("stop");
      workerRef.current.postMessage("ucinewgame");
    }
  };

  const undoMove = () => {
    const game = gameRef.current;
    if (thinkingRef.current) return;

    game.undo();
    if (game.history().length > 0 && game.turn() !== playerColor) {
      game.undo();
    }

    syncGame();
  };

  const flipBoard = playerColor === "b";
  const files = flipBoard
    ? ["h", "g", "f", "e", "d", "c", "b", "a"]
    : ["a", "b", "c", "d", "e", "f", "g", "h"];
  const ranks = flipBoard
    ? [1, 2, 3, 4, 5, 6, 7, 8]
    : [8, 7, 6, 5, 4, 3, 2, 1];

  return (
    <div className="play-page">
      <div className="play-heading">
        <div>
          <p className="eyebrow">GAME ROOM</p>
          <h1>Play Chess</h1>
          <p>Challenge the engine and sharpen your game.</p>
        </div>
        <button className="new-game-button" onClick={newGame}>
          + New Game
        </button>
      </div>

      <div className="play-layout">
        <section className="board-card">
          <div className="opponent-row">
            <span className="avatar">♟</span>
            <div>
              <strong>Qelvaris Engine</strong>
              <p>{thinking ? "Thinking..." : "Computer opponent"}</p>
            </div>
            <span className="engine-badge">
              {engineReady ? "ENGINE READY" : "LOADING"}
            </span>
          </div>

          <div className="chess-board" role="grid" aria-label="Chessboard">
            {ranks.map((rank) =>
              files.map((file) => {
                const square = `${file}${rank}`;
                const piece = gameRef.current.get(square);
                const isLight =
                  (file.charCodeAt(0) - 97 + rank) % 2 === 0;
                const isSelected = selected === square;
                const isLegal = legalMoves.includes(square);
                const isLastMove =
                  lastMove &&
                  (lastMove.from === square || lastMove.to === square);

                return (
                  <button
                    key={square}
                    type="button"
                    role="gridcell"
                    aria-label={`${square}${piece ? ` ${piece.color === "w" ? "white" : "black"} ${piece.type}` : ""}`}
                    className={[
                      "chess-square",
                      isLight ? "light-square" : "dark-square",
                      isSelected ? "selected-square" : "",
                      isLegal ? "legal-square" : "",
                      isLastMove ? "last-move-square" : "",
                    ].filter(Boolean).join(" ")}
                    onClick={() => handleSquareClick(square)}
                  >
                    {(file === files[0]) && (
                      <span className="rank-label">{rank}</span>
                    )}
                    {(rank === ranks[ranks.length - 1]) && (
                      <span className="file-label">{file}</span>
                    )}
                    {piece && (
                      <span
                        className={`chess-piece ${
                          piece.color === "w" ? "white-piece" : "black-piece"
                        }`}
                      >
                        {PIECES[piece.color][piece.type]}
                      </span>
                    )}
                    {isLegal && (
                      <span className={piece ? "capture-dot" : "move-dot"} />
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className="player-row">
            <span className="avatar player-avatar">♙</span>
            <div>
              <strong>You</strong>
              <p>{thinking ? "Waiting for engine..." : message}</p>
            </div>
            <button
              className="flip-button"
              onClick={() => {
                setPlayerColor((color) => (color === "w" ? "b" : "w"));
                newGame();
              }}
            >
              Flip sides
            </button>
          </div>
<div className="play-controls">
  <button onClick={saveCurrentGame}>
    Save Game
  </button>

  <label>
    Difficulty
    <select
      value={difficulty}
      onChange={(event) => setDifficulty(event.target.value)}
    >
      <option value="Easy">Easy</option>
      <option value="Medium">Medium</option>
      <option value="Hard">Hard</option>
    </select>
  </label>

  {saveMessage && (
    <p role="status">{saveMessage}</p>
  )}
</div>

        </section>

        <aside className="game-info-card">
          <p className="eyebrow">GAME STATUS</p>
          <h2>{gameRef.current.isGameOver() ? "Game Over" : "In Progress"}</h2>
          <p className="status-message">{message}</p>

          <div className="info-divider" />

          <div className="info-stat">
            <span>Moves played</span>
            <strong>{Math.ceil(history.length / 2)}</strong>
          </div>
          <div className="info-stat">
            <span>Side to move</span>
            <strong>{gameRef.current.turn() === "w" ? "White" : "Black"}</strong>
          </div>
          <div className="info-stat">
            <span>Engine</span>
            <strong>{engineReady ? "Ready" : "Loading"}</strong>
          </div>

          <div className="info-divider" />

          <h3>Move History</h3>
          <div className="move-history">
            {history.length === 0 ? (
              <p className="empty-history">Your moves will appear here.</p>
            ) : (
              Array.from({ length: Math.ceil(history.length / 2) }, (_, i) => (
                <div className="move-pair" key={i}>
                  <span>{i + 1}.</span>
                  <span>{history[i * 2]}</span>
                  <span>{history[i * 2 + 1] || "…"}</span>
                </div>
              ))
            )}
          </div>
<button
  className="save-game-button"
  onClick={saveCurrentGame}
>
  Save Game
</button>
          <div className="game-actions">
            <button onClick={undoMove} disabled={history.length === 0 || thinking}>
              ↶ Undo Move
            </button>
            <button onClick={newGame}>＋ New Game</button>
          </div>
        </aside>
      </div>
    </div>
  );
}
