
import { useMemo, useState } from "react";
import { Chess } from "chess.js";
import "./OpeningStudio.css";

const OPENINGS = [
  {
    id: "italian",
    name: "Italian Game",
    eco: "C50",
    category: "Open Game",
    level: "Beginner",
    color: "White",
    moves: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"],
    description:
      "Develop your pieces quickly, control the centre and prepare for a kingside attack.",
    idea: "Rapid development and pressure on the f7-square.",
  },
  {
    id: "ruy",
    name: "Ruy Lopez",
    eco: "C60",
    category: "Open Game",
    level: "Intermediate",
    color: "White",
    moves: ["e4", "e5", "Nf3", "Nc6", "Bb5"],
    description:
      "A classical opening that pressures Black's central knight and builds long-term central control.",
    idea: "Build pressure on e5 and prepare a strong centre.",
  },
  {
    id: "sicilian",
    name: "Sicilian Defense",
    eco: "B20",
    category: "Semi-Open",
    level: "Intermediate",
    color: "Black",
    moves: ["e4", "c5"],
    description:
      "Black fights for the centre asymmetrically and often gets dynamic counterplay.",
    idea: "Challenge d4 and create imbalanced positions.",
  },
  {
    id: "french",
    name: "French Defense",
    eco: "C00",
    category: "Semi-Open",
    level: "Intermediate",
    color: "Black",
    moves: ["e4", "e6", "d4", "d5"],
    description:
      "Black challenges White's centre with a solid pawn structure and counterattacking chances.",
    idea: "Attack the e4 pawn and challenge the centre with ...c5.",
  },
  {
    id: "queens-gambit",
    name: "Queen's Gambit",
    eco: "D06",
    category: "Closed Game",
    level: "Beginner",
    color: "White",
    moves: ["d4", "d5", "c4"],
    description:
      "White offers the c-pawn to challenge Black's central pawn and gain central influence.",
    idea: "Use central space and piece activity to build an advantage.",
  },
  {
    id: "caro",
    name: "Caro-Kann Defense",
    eco: "B10",
    category: "Semi-Open",
    level: "Beginner",
    color: "Black",
    moves: ["e4", "c6", "d4", "d5"],
    description:
      "A solid defence that supports a central ...d5 advance while aiming for a sound pawn structure.",
    idea: "Challenge White's centre with a reliable structure.",
  },
  {
    id: "london",
    name: "London System",
    eco: "D02",
    category: "Closed Game",
    level: "Beginner",
    color: "White",
    moves: ["d4", "d5", "Bf4"],
    description:
      "A system-based opening with a familiar setup and straightforward development plans.",
    idea: "Develop the light-squared bishop before playing e3.",
  },
  {
    id: "kings-indian",
    name: "King's Indian Defense",
    eco: "E60",
    category: "Closed Game",
    level: "Advanced",
    color: "Black",
    moves: ["d4", "Nf6", "c4", "g6", "Nc3", "Bg7"],
    description:
      "Black allows White central space and prepares active counterplay with a fianchettoed bishop.",
    idea: "Prepare ...e5 or ...c5 and counterattack the centre.",
  },
];

const PIECES = {
  w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
  b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" },
};

const FILES = "abcdefgh";

function createOpening(opening) {
  const chess = new Chess();
  const history = [chess.fen()];

  for (const move of opening.moves) {
    const played = chess.move(move);
    if (!played) {
      throw new Error(`Invalid move "${move}" in ${opening.name}`);
    }
    history.push(chess.fen());
  }

  return { chess, history };
}

function OpeningBoard({ fen, onSquareClick, selected, legalSquares }) {
  const chess = useMemo(() => new Chess(fen), [fen]);
  const board = chess.board();

  return (
    <div className="os-board-wrap">
      <div className="os-board">
        {board.map((rank, row) =>
          rank.map((piece, col) => {
            const square = `${FILES[col]}${8 - row}`;
            const light = (row + col) % 2 === 0;
            const isSelected = selected === square;
            const isLegal = legalSquares.includes(square);

            return (
              <button
                type="button"
                key={square}
                className={[
                  "os-square",
                  light ? "os-light" : "os-dark",
                  isSelected ? "os-selected" : "",
                  isLegal ? "os-legal" : "",
                ].filter(Boolean).join(" ")}
                onClick={() => onSquareClick(square)}
                aria-label={`${square}${piece ? ` ${piece.color === "w" ? "white" : "black"} ${piece.type}` : ""}`}
              >
                {piece && (
                  <span className={`os-piece ${piece.color === "w" ? "os-white-piece" : "os-black-piece"}`}>
                    {PIECES[piece.color][piece.type]}
                  </span>
                )}
                {col === 0 && <span className="os-rank">{8 - row}</span>}
                {row === 7 && <span className="os-file">{FILES[col]}</span>}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function OpeningStudio() {
  const [selectedId, setSelectedId] = useState("italian");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [level, setLevel] = useState("All");
  const [moveIndex, setMoveIndex] = useState(0);
  const [customFen, setCustomFen] = useState(null);
  const [boardFen, setBoardFen] = useState(new Chess().fen());
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [legalSquares, setLegalSquares] = useState([]);
  const [notice, setNotice] = useState("");
  const [showMoves, setShowMoves] = useState(true);

  const opening = OPENINGS.find((item) => item.id === selectedId) || OPENINGS[0];
  const openingData = useMemo(() => createOpening(opening), [opening]);
  const moveList = openingData.chess.history();
  const currentFen = customFen || openingData.history[moveIndex];

  const filtered = OPENINGS.filter((item) => {
    const matchesSearch = `${item.name} ${item.eco} ${item.category}`
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesCategory = category === "All" || item.category === category;
    const matchesLevel = level === "All" || item.level === level;
    return matchesSearch && matchesCategory && matchesLevel;
  });

  function selectOpening(item) {
    setSelectedId(item.id);
    setMoveIndex(0);
    setCustomFen(null);
    setBoardFen(new Chess().fen());
    setSelectedSquare(null);
    setLegalSquares([]);
    setNotice("");
  }

  function goToMove(index) {
    const nextIndex = Math.max(0, Math.min(index, openingData.history.length - 1));
    setMoveIndex(nextIndex);
    setCustomFen(null);
    setBoardFen(openingData.history[nextIndex]);
    setSelectedSquare(null);
    setLegalSquares([]);
    setNotice(nextIndex === 0 ? "Starting position" : `Position after ${nextIndex} half-move${nextIndex === 1 ? "" : "s"}.`);
  }

  function handleSquareClick(square) {
    try {
      const chess = new Chess(customFen || currentFen);

      if (selectedSquare) {
        const move = chess.move({ from: selectedSquare, to: square, promotion: "q" });
        if (move) {
          setCustomFen(chess.fen());
          setBoardFen(chess.fen());
          setSelectedSquare(null);
          setLegalSquares([]);
          setNotice(`Exploration move: ${move.san}. Reset to return to the opening line.`);
          return;
        }
      }

      const piece = chess.get(square);
      if (piece && piece.color === chess.turn()) {
        setSelectedSquare(square);
        setLegalSquares(chess.moves({ square, verbose: true }).map((move) => move.to));
        setNotice("Choose a highlighted square to explore a legal move.");
      } else {
        setSelectedSquare(null);
        setLegalSquares([]);
      }
    } catch {
      setNotice("This move could not be played. Reset the position and try again.");
    }
  }

  function resetLine() {
    setMoveIndex(0);
    setCustomFen(null);
    setBoardFen(openingData.history[0]);
    setSelectedSquare(null);
    setLegalSquares([]);
    setNotice("Opening reset to the starting position.");
  }

  function showOpeningMoves() {
    setShowMoves((value) => !value);
  }

  const visibleFen = customFen || boardFen || currentFen;

  return (
    <main className="opening-studio-page">
      <header className="os-header">
        <div>
          <p className="os-eyebrow">CHESS KNOWLEDGE</p>
          <h1>Opening Studio</h1>
          <p className="os-subtitle">
            Explore openings, understand their plans, and practise every move.
          </p>
        </div>
        <div className="os-header-badge">
          <span>♟</span>
          <div>
            <strong>{OPENINGS.length} openings</strong>
            <small>Learning library</small>
          </div>
        </div>
      </header>

      <section className="os-explorer">
        <aside className="os-library">
          <div className="os-library-title">
            <div>
              <h2>Opening Library</h2>
              <p>Find your next opening</p>
            </div>
            <span className="os-count">{filtered.length}</span>
          </div>

          <label className="os-search">
            <span>⌕</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search openings or ECO..."
            />
          </label>

          <div className="os-filter">
            <label>
              <span>Type</span>
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                <option>All</option>
                <option>Open Game</option>
                <option>Semi-Open</option>
                <option>Closed Game</option>
              </select>
            </label>
            <label>
              <span>Level</span>
              <select value={level} onChange={(event) => setLevel(event.target.value)}>
                <option>All</option>
                <option>Beginner</option>
                <option>Intermediate</option>
                <option>Advanced</option>
              </select>
            </label>
          </div>

          <div className="os-opening-list">
            {filtered.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`os-opening-item ${selectedId === item.id ? "active" : ""}`}
                onClick={() => selectOpening(item)}
              >
                <span className="os-opening-icon">{item.color === "White" ? "♔" : "♚"}</span>
                <span className="os-opening-text">
                  <strong>{item.name}</strong>
                  <small>{item.eco} · {item.level}</small>
                </span>
                <span className="os-chevron">›</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="os-empty">No openings match those filters.</p>
            )}
          </div>
        </aside>

        <div className="os-main">
          <section className="os-opening-intro">
            <div className="os-intro-top">
              <span className="os-opening-tag">{opening.category}</span>
              <span className="os-opening-tag">{opening.level}</span>
              <span className="os-eco">ECO {opening.eco}</span>
            </div>
            <h2>{opening.name}</h2>
            <p>{opening.description}</p>
            <div className="os-idea">
              <span>✦</span>
              <div>
                <strong>Strategic idea</strong>
                <p>{opening.idea}</p>
              </div>
            </div>
          </section>

          <section className="os-study-layout">
            <div className="os-board-panel">
              <div className="os-board-heading">
                <div>
                  <h3>Study Board</h3>
                  <p>Explore legal moves on the board</p>
                </div>
                <span className="os-turn">
                  {new Chess(visibleFen).turn() === "w" ? "White to move" : "Black to move"}
                </span>
              </div>

              <OpeningBoard
                fen={visibleFen}
                selected={selectedSquare}
                legalSquares={legalSquares}
                onSquareClick={handleSquareClick}
              />

              <div className="os-board-controls">
                <button type="button" onClick={() => goToMove(moveIndex - 1)} disabled={moveIndex === 0 || !!customFen}>← Previous</button>
                <button type="button" onClick={resetLine}>↺ Reset</button>
                <button type="button" onClick={() => goToMove(moveIndex + 1)} disabled={moveIndex >= openingData.history.length - 1 || !!customFen}>Next →</button>
              </div>

              <p className="os-notice" role="status">
                {notice || "Select an opening, then step through its main line or explore moves."}
              </p>
            </div>

            <aside className="os-moves-panel">
              <div className="os-panel-heading">
                <div>
                  <h3>Opening Line</h3>
                  <p>Main line moves</p>
                </div>
                <button type="button" onClick={showOpeningMoves}>{showMoves ? "Hide" : "Show"}</button>
              </div>

              {showMoves && (
                <>
                  <div className="os-move-list">
                    {moveList.map((move, index) => {
                      const moveNumber = Math.floor(index / 2) + 1;
                      return (
                        <button
                          type="button"
                          key={`${move}-${index}`}
                          className={`os-move ${moveIndex === index + 1 ? "current" : ""}`}
                          onClick={() => goToMove(index + 1)}
                        >
                          <span>{index % 2 === 0 ? `${moveNumber}.` : "..."}</span>
                          <strong>{move}</strong>
                        </button>
                      );
                    })}
                    {moveList.length === 0 && <p className="os-empty">No moves available.</p>}
                  </div>
                  <button type="button" className="os-start-position" onClick={() => goToMove(0)}>
                    View starting position
                  </button>
                </>
              )}
            </aside>
          </section>

          <section className="os-learning-card">
            <div className="os-learning-icon">✦</div>
            <div>
              <h3>What to remember</h3>
              <p>
                Learn the purpose behind each move, not just the move order.
                After studying this line, explore legal alternatives and think
                about development, king safety and central control.
              </p>
            </div>
          </section>

          <p className="os-footer-note">
            Learning library · Main lines are study examples, not the only playable continuations.
          </p>
        </div>
      </section>
    </main>
  );
}
