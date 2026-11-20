import { useCallback, useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import Board from "./Board";
import {
  MAX_PLIES,
  buildTrees,
  defaultPath,
  fenForPath,
  findGaps,
  getUsernames,
  lineLabel,
  nodeAt,
  nodeStats,
  openingName,
  saveUsernames,
  scoreClass,
} from "./openingsData";
import { OPENING_LINES } from "./openings";
import { getSetting, setSetting } from "./storage";
import "./Openings.css";
import "./OpeningsGlow.css";
import "./OpeningTreeTheme.css";
import "./shell/OpeningsBackground.css";
import "./shell/OpeningsPolish.css";
import "./shell/OpeningsTheme.css";
import PageLoader, { usePageLoaderDelay } from "./PageLoader";
import OpeningExplorer from "./explorer/OpeningExplorer";
import LabHome from "./middlegames/LabHome";
import LabProgress from "./middlegames/LabProgress";
import OpeningsSidebar from "./shell/OpeningsSidebar";
import PracticeArena from "./practice/PracticeArena";
import OpeningLibrary from "./library/OpeningLibrary";

function go(page, extra = {}) {
  window.dispatchEvent(
    new CustomEvent("qelvaris-navigate", { detail: { page, ...extra } })
  );
}

const pct = (score) => `${Math.round(score * 100)}%`;
const plural = (n) => `${n} game${n === 1 ? "" : "s"}`;
const sideName = (color) => (color === "w" ? "White" : "Black");
const START_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function moveLabel(ply, san) {
  const number = Math.ceil(ply / 2);
  return ply % 2 === 1 ? `${number}.${san}` : `${number}…${san}`;
}

function categoryFor(name) {
  if (
    /Sicilian|French|Caro-Kann|Scandinavian|Pirc|Alekhine|Nimzowitsch Defense|Petrov|Philidor|Dutch|Latvian/i.test(
      name
    )
  )
    return "Defences";

  if (
    /Queen's Gambit|London|Colle|King's Indian|Grünfeld|Nimzo-Indian|Queen's Indian|Catalan|Réti|English|Zukertort|Bird|Larsen/i.test(
      name
    )
  )
    return "Queen's Pawn & Flank";

  return "King's Pawn & Open Games";
}

function difficultyFor(name) {
  if (
    /Najdorf|Grünfeld|Winawer|Sveshnikov|Catalan|Nimzo-Indian|Berlin/i.test(
      name
    )
  )
    return "Advanced";

  if (
    /Sicilian|French|Caro-Kann|King's Indian|Queen's Gambit|Ruy Lopez|Dragon|Nimzo/i.test(
      name
    )
  )
    return "Intermediate";

  return "Beginner";
}

function descriptionFor(name) {
  if (/Italian/.test(name))
    return "Develop quickly, control the centre and target the f7-square.";
  if (/Sicilian/.test(name))
    return "An ambitious response to 1.e4, creating an unbalanced position.";
  if (/London/.test(name))
    return "A reliable system built around a solid pawn structure and Bf4.";
  if (/Queen's Gambit/.test(name))
    return "Fight for central control with the c-pawn and active piece play.";
  if (/French/.test(name))
    return "Challenge White's centre with ...d5 and build a resilient structure.";
  if (/Caro-Kann/.test(name))
    return "A sound defence focused on a strong pawn structure.";
  if (/Ruy Lopez/.test(name))
    return "Put pressure on the e5-knight and build long-term central control.";
  if (/King's Indian/.test(name))
    return "Allow a broad centre, then counterattack with dynamic piece play.";

  return "Learn the key ideas, typical plans and common move orders.";
}

function openingMoves(moves) {
  const chess = new Chess();
  const result = [];

  for (const san of moves.split(" ").filter(Boolean)) {
    try {
      const played = chess.move(san);
      if (!played) break;

      result.push({
        san: played.san,
        fen: chess.fen(),
        color: played.color,
        from: played.from,
        to: played.to,
      });
    } catch {
      break;
    }
  }

  return result;
}

/* Openings khulne par loader kam se kam itni der (ms) dikhega. 0 = sirf real loading tak. */
const MIN_LOADER_MS = 0; // QV-PERF (pehle 1200)

const LOADING_STEPS = [
  "Fetching your games…",
  "Reading your usernames…",
  "Building your opening trees…",
];

/* ---------------- Opening Tree ---------------- */

const ROW = 98;
const STEP = 210;
const X0 = 84;

function layoutTree(root, path) {
  const columns = [];
  let node = root;

  for (
    let depth = 0;
    node && depth <= path.length && depth < MAX_PLIES;
    depth += 1
  ) {
    if (!node.children.length) break;

    columns.push({
      nodes: node.children,
      selected: path[depth],
    });

    node = node.children.find((c) => c.san === path[depth]);
  }

  const tallest = Math.max(1, ...columns.map((c) => c.nodes.length));
  const height = Math.max(430, tallest * ROW + 70);
  const placed = [];
  let parentY = height / 2;

  columns.forEach((col, depth) => {
    const n = col.nodes.length;
    let top = parentY - ((n - 1) * ROW) / 2;
    const bottomLimit = height - 66;

    if (top + (n - 1) * ROW > bottomLimit) {
      top = bottomLimit - (n - 1) * ROW;
    }

    if (top < 48) top = 48;

    const items = col.nodes.map((node2, j) => ({
      node: node2,
      x: X0 + depth * STEP,
      y: top + j * ROW,
    }));

    placed.push({ items, selected: col.selected });

    const chosen = items.find((it) => it.node.san === col.selected);
    parentY = chosen ? chosen.y : parentY;
  });

  return {
    placed,
    width: X0 + Math.max(0, columns.length - 1) * STEP + 130,
    height,
  };
}

function Ring({ value, percent, label, tone }) {
  const p = Math.max(0, Math.min(100, percent || 0));
  return (
    <div className={`qo-ring qo-ring--${tone}`}>
      <svg viewBox="0 0 52 52" aria-hidden="true">
        <circle className="qo-ring-bg" cx="26" cy="26" r="22" />
        <circle className="qo-ring-fg" cx="26" cy="26" r="22" strokeDasharray={`${p * 1.382} 138.2`} />
      </svg>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function Tree({ root, path, color, onPick }) {
  const { placed, width, height } = useMemo(
    () => layoutTree(root, path),
    [root, path]
  );

  const rootGames = Math.max(root.games, 1);
  const radius = (games) => 8 + 28 * Math.sqrt(games / rootGames);

  const nameFor = (depthIndex, node) => {
    const chain = [...path.slice(0, depthIndex), node.san];

    if (chain.length < 3) return "";

    const here = openingName(chain);
    const before =
      depthIndex > 0 ? openingName(path.slice(0, depthIndex)) : "";

    return here !== lineLabel(chain) && here !== before ? here : "";
  };

  return (
    <div className="qo-treewrap">
      <svg
        className="qo-svg"
        viewBox={`0 0 ${width} ${height}`}
        style={{ minWidth: Math.min(width, 720) }}
        role="group"
        aria-label={`Your opening tree as ${sideName(color)}`}
      >
        <defs>
          <filter id="qo-glow" filterUnits="userSpaceOnUse" x="-200" y="-200" width="3000" height="3000">
            <feGaussianBlur stdDeviation="2.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {[["good", "#27a2ac"], ["mid", "#a98934"], ["bad", "#b2376c"], ["few", "#576776"]].map(([k, c]) => (
            <radialGradient key={k} id={`qo-g-${k}`} cx="35%" cy="30%">
              <stop offset="0" stopColor="#fff" stopOpacity=".6" />
              <stop offset=".4" stopColor={c} />
              <stop offset="1" stopColor={c} stopOpacity=".45" />
            </radialGradient>
          ))}
        </defs>
        {placed.map((col, depth) => {
          if (depth === 0) return null;

          const parent = placed[depth - 1].items.find(
            (it) => it.node.san === placed[depth - 1].selected
          );

          if (!parent) return null;

          return col.items.map((it) => (
            <path
              key={`e-${depth}-${it.node.san}`}
              d={`M${parent.x} ${parent.y} C${(parent.x + it.x) / 2} ${parent.y} ${(parent.x + it.x) / 2} ${it.y} ${it.x} ${it.y}`}
              className={`qo-edge qo-edge--${scoreClass(it.node)}`}
              style={{ strokeWidth: 1.4 + 3 * Math.sqrt(it.node.games / rootGames) }}
              filter="url(#qo-glow)"
            />
          ));
        })}

        {placed.map((col, depth) =>
          col.items.map((it) => {
            const cls = scoreClass(it.node);
            const r = radius(it.node.games);
            const isSel = col.selected === it.node.san;
            const extra = nameFor(depth, it.node);

            const label = `${moveLabel(it.node.ply, it.node.san)}${
              extra ? ` ${extra}` : ""
            }`;

            const pick = () => onPick(depth, it.node.san);

            return (
              <g
                key={`${depth}-${it.node.san}`}
                className="qo-tn"
                role="button"
                tabIndex={0}
                aria-pressed={isSel}
                aria-label={`${label}, ${plural(it.node.games)}`}
                onClick={pick}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    pick();
                  }
                }}
              >
                {isSel && (
                  <circle
                    cx={it.x}
                    cy={it.y}
                    r={r + 8}
                    className="qo-halo"
                  />
                )}

                <circle
                  cx={it.x}
                  cy={it.y}
                  r={r}
                  className={`qo-c qo-c--${cls}`}
                  filter="url(#qo-glow)"
                />

                <text
                  x={it.x}
                  y={it.y + r + 17}
                  textAnchor="middle"
                  className="qo-t1"
                >
                  {label}
                </text>

                <text
                  x={it.x}
                  y={it.y + r + 32}
                  textAnchor="middle"
                  className="qo-t2"
                >
                  {plural(it.node.games)}
                  {it.node.games >= 2 ? ` · ${pct(it.node.score)}` : ""}
                </text>
              </g>
            );
          })
        )}
      </svg>
    </div>
  );
}

function UsernameCard({ names, onSave, highlight }) {
  const [text, setText] = useState(names.join(", "));

  return (
    <section className={`qo-card ${highlight ? "qo-card--hl" : ""}`}>
      <div className="qo-eyebrow">Your usernames</div>

      <p className="qo-note">
        Tree banane ke liye pata hona chahiye ki har game mein aap White the
        ya Black. Apne Lichess / Chess.com naam daalo (comma se alag).
      </p>

      <div className="qo-form">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="jaise: ravi_chess, ravi88"
          aria-label="Your usernames"
        />

        <button
          className="qo-btn qo-btn--primary"
          onClick={() =>
            onSave(
              text
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            )
          }
        >
          Save
        </button>
      </div>
    </section>
  );
}

/* ---------------- Opening Academy ---------------- */

/* Abhi sirf ye openings page par dikhengi. Nayi opening add karni ho toh
   uska naam yahan jodo (naam openings.js ki list jaisa hi hona chahiye). */
const ENABLED_OPENINGS = ["Italian Game"];

const OPENINGS = OPENING_LINES.filter((line) =>
  ENABLED_OPENINGS.includes(line.name)
).map((line, index) => ({
  ...line,
  id: `${line.name}-${index}`,
  category: categoryFor(line.name),
  difficulty: difficultyFor(line.name),
  description: descriptionFor(line.name),
}));

function SectionHeading({ eyebrow, title, description, meta }) {
  const words = String(title).split(" ");
  const last = words.pop();
  return (
    <header className="qs-head">
      <div className="qs-head-copy">
        <div className="qs-head-eyebrow">{eyebrow}</div>
        <h2>
          {words.length ? `${words.join(" ")} ` : ""}
          <span>{last}</span>
        </h2>
        {description && <p>{description}</p>}
      </div>
      {meta && <div className="qs-head-meta">{meta}</div>}
    </header>
  );
}

/* ---------------- Explore ---------------- */

function ExplorePanel({ onStudy, onExplore, savedIds, onToggleSave }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [difficulty, setDifficulty] = useState("All");

  const categories = ["All", ...new Set(OPENINGS.map((o) => o.category))];

  const filtered = OPENINGS.filter((o) => {
    const matchesSearch = o.name
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchesCategory =
      category === "All" || o.category === category;

    const matchesDifficulty =
      difficulty === "All" || o.difficulty === difficulty;

    return matchesSearch && matchesCategory && matchesDifficulty;
  });

  return (
    <div className="qo-panel-content">
      <div className="qo-explore-tools">
        <input
          className="qo-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search opening name..."
        />

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {categories.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>

        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
        >
          {["All", "Beginner", "Intermediate", "Advanced"].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>

      <div className="qo-result-count">
        {filtered.length} openings found
      </div>

      <div className="qo-opening-grid">
        {filtered.map((opening) => (
          <article className="qo-opening-card" key={opening.id}>
            <div className="qo-opening-card-top">
              <span className="qo-mini-tag">{opening.difficulty}</span>

              <button
                className={`qo-save-icon ${
                  savedIds.includes(opening.name) ? "is-saved" : ""
                }`}
                onClick={() => onToggleSave(opening.name)}
                title={
                  savedIds.includes(opening.name)
                    ? "Remove from repertoire"
                    : "Save to repertoire"
                }
                aria-label="Save opening"
              >
                {savedIds.includes(opening.name) ? "★" : "☆"}
              </button>
            </div>

            <h3>{opening.name}</h3>
            <p>{opening.description}</p>

            <div className="qo-opening-card-bottom">
              <span>{opening.category}</span>
              {onExplore && opening.name === "Italian Game" && (
                <button onClick={onExplore}>
                  Explore variations <span>→</span>
                </button>
              )}
              <button onClick={() => onStudy(opening)}>
                Study <span>→</span>
              </button>
            </div>
          </article>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="qo-empty">
          No openings match these filters. Try another search.
        </div>
      )}
    </div>
  );
}

/* ---------------- Study ---------------- */

function StudyPanel({ opening, onSelectOpening }) {
  const [ply, setPly] = useState(0);

  const moves = useMemo(
    () => openingMoves(opening.moves),
    [opening]
  );

  const currentFen =
    ply === 0 ? START_FEN : moves[ply - 1]?.fen || START_FEN;

  const currentMove = moves[ply - 1];
  const movePairs = [];

  for (let i = 0; i < moves.length; i += 2) {
    movePairs.push({
      number: Math.floor(i / 2) + 1,
      white: moves[i]?.san || "",
      black: moves[i + 1]?.san || "",
      whitePly: i + 1,
      blackPly: i + 2,
    });
  }

  return (
    <div className="qo-panel-content">
      <div className="qo-study-top">
        <div>
          <span className="qo-mini-tag">
            {difficultyFor(opening.name)}
          </span>

          <h3>{opening.name}</h3>
          <p>{descriptionFor(opening.name)}</p>
        </div>

        <select
          value={opening.name}
          onChange={(e) => {
            const found = OPENINGS.find(
              (o) => o.name === e.target.value
            );

            if (found) {
              setPly(0);
              onSelectOpening(found);
            }
          }}
        >
          {[...new Set(OPENINGS.map((o) => o.name))].map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
      </div>

      <div className="qo-study-layout">
        <div className="qo-study-board">
          <Board
            fen={currentFen}
            showCoords
            lastMove={
              currentMove
                ? {
                    from: currentMove.from,
                    to: currentMove.to,
                  }
                : null
            }
          />

          <div className="qo-board-controls">
            <button
              className="qo-btn"
              disabled={ply === 0}
              onClick={() => setPly(0)}
            >
              ⏮ Start
            </button>

            <button
              className="qo-btn"
              disabled={ply === 0}
              onClick={() => setPly((p) => Math.max(0, p - 1))}
            >
              ← Back
            </button>

            <span>
              {ply} / {moves.length} plies
            </span>

            <button
              className="qo-btn qo-btn--primary"
              disabled={ply >= moves.length}
              onClick={() =>
                setPly((p) => Math.min(moves.length, p + 1))
              }
            >
              Next →
            </button>

            <button
              className="qo-btn"
              onClick={() => setPly(moves.length)}
            >
              End ⏭
            </button>
          </div>
        </div>

        <aside className="qo-study-info">
          <div className="qo-eyebrow">Move-by-move</div>

          <div className="qo-move-list">
            {movePairs.map((pair) => (
              <div className="qo-move-row" key={pair.number}>
                <span>{pair.number}.</span>

                <button
                  className={
                    ply === pair.whitePly ? "is-current" : ""
                  }
                  onClick={() => setPly(pair.whitePly)}
                >
                  {pair.white}
                </button>

                {pair.black && (
                  <button
                    className={
                      ply === pair.blackPly ? "is-current" : ""
                    }
                    onClick={() => setPly(pair.blackPly)}
                  >
                    {pair.black}
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="qo-lesson-note">
            <strong>
              {ply === 0
                ? "Starting position"
                : `After ${currentMove?.san || "the move"}`}
            </strong>

            <p>
              {ply === 0
                ? "Follow the moves to understand how this opening develops."
                : `${currentMove?.color === "w" ? "White" : "Black"} played ${currentMove?.san}. Observe the piece placement and central control.`}
            </p>
          </div>

          <div className="qo-study-tip">
            <strong>Opening idea</strong>
            <p>{descriptionFor(opening.name)}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ---------------- Practice ---------------- */

function PracticePanel({ onBackToExplore }) {
  const [opening, setOpening] = useState(
    OPENINGS.find((o) => o.name === "Italian Game") || OPENINGS[0]
  );

  const [positionIndex, setPositionIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState({
    correct: 0,
    total: 0,
  });

  const quiz = useMemo(() => {
    const chess = new Chess();
    const sans = opening.moves.split(" ").filter(Boolean);
    const positions = [];

    for (const san of sans) {
      const before = chess.fen();
      const legalMoves = chess.moves();

      try {
        const played = chess.move(san);

        if (played) {
          const options = [
            ...new Set([
              played.san,
              ...legalMoves
                .filter((m) => m !== played.san)
                .slice(0, 3),
            ]),
          ];

          positions.push({
            fen: before,
            correct: played.san,
            options: options.sort(() => 0.5 - Math.random()),
          });
        }
      } catch {
        break;
      }
    }

    return positions;
  }, [opening]);

  const current = quiz[positionIndex];

  function choose(option) {
    if (!current || answer) return;

    const correct = option === current.correct;

    setAnswer(
      correct
        ? "Correct! Nice move."
        : `Not quite. The move is ${current.correct}.`
    );

    setScore((s) => ({
      correct: s.correct + (correct ? 1 : 0),
      total: s.total + 1,
    }));
  }

  function next() {
    setAnswer("");

    if (positionIndex + 1 >= quiz.length) {
      setPositionIndex(0);
      setScore({ correct: 0, total: 0 });
    } else {
      setPositionIndex((p) => p + 1);
    }
  }

  return (
    <div className="qo-panel-content">
      <div className="qo-practice-head">
        <div>
          <span className="qo-mini-tag">Move challenge</span>
          <h3>Find the opening move</h3>
          <p>
            Choose the move that continues the selected opening.
            Your answer is checked against the legal opening line.
          </p>
        </div>

        <select
          value={opening.name}
          onChange={(e) => {
            const found = OPENINGS.find(
              (o) => o.name === e.target.value
            );

            if (found) {
              setOpening(found);
              setPositionIndex(0);
              setAnswer("");
              setScore({ correct: 0, total: 0 });
            }
          }}
        >
          {[...new Set(OPENINGS.map((o) => o.name))].map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
      </div>

      {current ? (
        <div className="qo-practice-layout">
          <div className="qo-practice-board">
            <Board fen={current.fen} showCoords />

            <div className="qo-practice-progress">
              <span>
                Question {positionIndex + 1} of {quiz.length}
              </span>

              <span>
                Score: {score.correct}/{score.total}
              </span>
            </div>
          </div>

          <div className="qo-practice-options">
            <div className="qo-eyebrow">Choose the next move</div>
            <h3>{opening.name}</h3>

            <div className="qo-answer-grid">
              {current.options.map((option) => (
                <button
                  key={option}
                  className={`qo-answer ${
                    answer && option === current.correct
                      ? "is-correct"
                      : ""
                  }`}
                  disabled={!!answer}
                  onClick={() => choose(option)}
                >
                  {option}
                </button>
              ))}
            </div>

            {answer && (
              <div
                className={`qo-answer-feedback ${
                  answer.startsWith("Correct")
                    ? "is-correct"
                    : "is-wrong"
                }`}
              >
                {answer}
              </div>
            )}

            <button
              className="qo-btn qo-btn--primary"
              disabled={!answer}
              onClick={next}
            >
              {positionIndex + 1 >= quiz.length
                ? "Restart practice"
                : "Next question →"}
            </button>

            <button
              className="qo-text-btn"
              onClick={onBackToExplore}
            >
              Browse other openings
            </button>
          </div>
        </div>
      ) : (
        <div className="qo-empty">
          This opening does not have a valid move sequence to practise.
        </div>
      )}
    </div>
  );
}

/* ---------------- My Repertoire ---------------- */

function RepertoirePanel({ savedIds, onToggleSave, onStudy }) {
  const saved = OPENINGS.filter((o) =>
    savedIds.includes(o.name)
  );

  return (
    <div className="qo-panel-content">
      <div className="qo-repertoire-summary">
        <div>
          <div className="qo-eyebrow">Your personal library</div>
          <h3>My Repertoire</h3>
          <p>
            Save openings you want to learn and build your White and
            Black preparation.
          </p>
        </div>

        <div className="qo-repertoire-count">
          <strong>{saved.length}</strong>
          <span>saved openings</span>
        </div>
      </div>

      {saved.length ? (
        <div className="qo-opening-grid">
          {saved.map((opening) => (
            <article className="qo-opening-card" key={opening.id}>
              <div className="qo-opening-card-top">
                <span className="qo-mini-tag">
                  {opening.difficulty}
                </span>

                <button
                  className="qo-save-icon is-saved"
                  onClick={() => onToggleSave(opening.name)}
                >
                  ★
                </button>
              </div>

              <h3>{opening.name}</h3>
              <p>{opening.description}</p>

              <div className="qo-opening-card-bottom">
                <span>{opening.category}</span>
                <button onClick={() => onStudy(opening)}>
                  Study →
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="qo-empty">
          <div className="qo-empty-icon">☆</div>
          <h3>Your repertoire is empty</h3>
          <p>
            Explore openings and press the star to save them here.
          </p>
        </div>
      )}
    </div>
  );
}

/* ---------------- Main page cards ---------------- */


function OpeningsPage({ onSection }) {
  const [data, setData] = useState(null);
  const [names, setNames] = useState([]);
  const [error, setError] = useState("");
  const [color, setColor] = useState("w");
  const [picked, setPicked] = useState(null);
  const [activeSection, setActiveSection] = useState("");
  const [selectedOpening, setSelectedOpening] = useState(OPENINGS[0]);
  const [savedIds, setSavedIds] = useState([]);
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [labLesson, setLabLesson] = useState("");
  const [arenaPosition, setArenaPosition] = useState("");
  const minDone = usePageLoaderDelay(MIN_LOADER_MS);

  const load = useCallback(async () => {
    try {
      const [built, saved, repertoire] = await Promise.all([
        buildTrees(),
        getUsernames(),
        getSetting("qelvaris-opening-repertoire", []),
      ]);

      setData(built);
      setNames(saved);
      setSavedIds(Array.isArray(repertoire) ? repertoire : []);
    } catch (err) {
      console.error("Openings load failed:", err);
      setError(
        "Openings load nahi ho payi. Page refresh karke dekho."
      );
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    onSection?.(activeSection);
  }, [activeSection, onSection]);

  /* Navbar dropdown se section kholna: tree / explore / study / practice / repertoire */
  useEffect(() => {
    function onSubNavigate(event) {
      const detail = event.detail;
      if (!detail || detail.page !== "Openings") return;

      const next = detail.section === "tree" ? "" : detail.section;
      if (["", "explore", "study", "practice", "repertoire", "lab", "arena", "progress"].includes(next)) {
        setActiveSection(next);
        setExplorerOpen(false);
        setLabLesson("");
        setArenaPosition("");
      }
    }

    window.addEventListener("qelvaris-subnavigate", onSubNavigate);
    return () => window.removeEventListener("qelvaris-subnavigate", onSubNavigate);
  }, []);

  async function onSaveNames(list) {
    await saveUsernames(list);
    setPicked(null);
    await load();
  }

  async function toggleSave(name) {
    const next = savedIds.includes(name)
      ? savedIds.filter((item) => item !== name)
      : [...savedIds, name];

    setSavedIds(next);

    try {
      await setSetting("qelvaris-opening-repertoire", next);
    } catch (err) {
      console.error("Could not save repertoire:", err);
    }
  }

  function startStudy(opening) {
    setSelectedOpening(opening);
    setActiveSection("study");
  }

  const root = data?.trees[color];

  const path = useMemo(
    () => picked ?? (root ? defaultPath(root) : []),
    [picked, root]
  );

  const selectedNode = useMemo(
    () => (root ? nodeAt(root, path) : null),
    [root, path]
  );

  const gaps = useMemo(
    () => (root ? findGaps(root) : []),
    [root]
  );

  const stats = useMemo(
    () =>
      data && selectedNode && path.length
        ? nodeStats(selectedNode, data.records)
        : null,
    [data, selectedNode, path]
  );

  if (error) {
    return (
      <div className="qo-page">
        <p className="qo-note">{error}</p>
      </div>
    );
  }

  if (!data || !minDone) {
    return (
      <PageLoader
        page="openings"
        title="Preparing your openings..."
        messages={LOADING_STEPS}
      />
    );
  }

  const total = data.usedCount.w + data.usedCount.b;

  const isWeakest =
    gaps.length > 0 &&
    gaps[0].path.join(" ") === path.join(" ");

  const prepText = !stats
    ? ""
    : stats.exit
      ? `You leave your preparation at move ${stats.exit.move} in ${stats.exit.count} of ${stats.reviewed} reviewed ${
          stats.reviewed === 1 ? "game" : "games"
        }.${isWeakest ? ` This is your weakest ${sideName(color)} line.` : ""}`
      : "Review these games to see where you leave your preparation.";

  /* =====================================================
     DEDICATED FULL-PAGE VIEWS
     When a card is clicked, only its selected section
     is rendered. The main tree and hub are hidden.
  ===================================================== */

  if (activeSection) {
    return (
      <div className="qo-page qo-page--workspace-only">
        <section className="qo-workspace qo-workspace--full">
          {activeSection === "explore" && explorerOpen && (
            <OpeningExplorer
              opening={explorerOpen}
              onBack={() => setExplorerOpen("")}
              onLearnLesson={(id) => {
                setLabLesson(id);
                setExplorerOpen("");
                setActiveSection("lab");
              }}
              onPlayMiddlegame={(lessonId) => {
                setArenaPosition(`prx_${lessonId}`);
                setExplorerOpen("");
                setActiveSection("arena");
              }}
            />
          )}

          {activeSection === "explore" && !explorerOpen && (
            <>
              <SectionHeading
                eyebrow="Opening library"
                title="Explore Openings"
                description="Search the opening library and discover new lines."
                onBack={() => setActiveSection("")}
              />

              <OpeningLibrary
                onOpen={(opening) => setExplorerOpen(opening.name)}
              />
            </>
          )}

          {activeSection === "study" && (
            <>
              <SectionHeading
                eyebrow="Interactive lessons"
                title="Study Openings"
                description="Step through the opening line and inspect every position."
                onBack={() => setActiveSection("")}
              />

              <StudyPanel
                opening={selectedOpening}
                onSelectOpening={setSelectedOpening}
              />
            </>
          )}

          {activeSection === "practice" && (
            <>
              <SectionHeading
                eyebrow="Knowledge check"
                title="Practice Openings"
                description="Choose the correct continuation from the legal opening moves."
                onBack={() => setActiveSection("")}
              />

              <PracticePanel
                onBackToExplore={() => setActiveSection("explore")}
              />
            </>
          )}

          {activeSection === "repertoire" && (
            <>
              <SectionHeading
                eyebrow="Saved collection"
                title="My Repertoire"
                description="Keep the openings you want to prepare and revisit."
                onBack={() => setActiveSection("")}
              />

              <RepertoirePanel
                savedIds={savedIds}
                onToggleSave={toggleSave}
                onStudy={startStudy}
              />
            </>
          )}

          {activeSection === "lab" && (
            <LabHome
              lessonId={labLesson}
              onBack={() => {
                setActiveSection("");
                setLabLesson("");
              }}
              onPlay={(lessonId) => {
                setArenaPosition(`prx_${lessonId}`);
                setActiveSection("arena");
              }}
            />
          )}

          {activeSection === "progress" && (
            <LabProgress
              repertoireCount={savedIds.length}
              onOpenLab={() => setActiveSection("lab")}
              onLearn={(id) => {
                setLabLesson(id);
                setActiveSection("lab");
              }}
            />
          )}

          {activeSection === "arena" && (
            <>
              <SectionHeading
                eyebrow="Practice game"
                title="Middlegame Practice"
                description="Pick a middlegame, choose the AI strength, play it out and compare your moves with its top 3."
                onBack={() => {
                  setActiveSection("");
                  setArenaPosition("");
                }}
              />

              <PracticeArena startPositionId={arenaPosition} />
            </>
          )}
        </section>
      </div>
    );
  }

  /* ---------------- Main Opening page ---------------- */

  return (
    <div className="qo-page">
      {total === 0 && (
        <UsernameCard
          names={names}
          onSave={onSaveNames}
          highlight
        />
      )}

      {total > 0 && (
        <>
        <header className="qs-head">
          <div className="qs-head-copy">
            <div className="qs-head-eyebrow">Your games</div>
            <h2>
              Opening <span>Tree</span>
            </h2>
            <p>Every opening you played, how it scored, and where you leave your preparation.</p>
          </div>
          <div className="qs-head-meta">
            <span><b>{total}</b>games</span>
            <span><b>{root.children.length}</b>first moves</span>
            <span><b>{gaps.length}</b>weak lines</span>
          </div>
        </header>
        <div className="qo-layout">
          <section className="qo-card qo-treecard">
            <div className="qo-cardhead">
              <div className="qo-eyebrow">
                Your opening tree · as {sideName(color)}
              </div>

              <div className="qo-tabs" role="tablist">
                {[
                  ["w", "As White"],
                  ["b", "As Black"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={color === id}
                    className={`qo-tab ${
                      color === id ? "is-active" : ""
                    }`}
                    onClick={() => {
                      setColor(id);
                      setPicked(null);
                    }}
                  >
                    {label}
                    <span className="qo-n">
                      {data.usedCount[id]}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {root.children.length === 0 ? (
              <p className="qo-note">
                Is rang mein abhi koi game nahi.
              </p>
            ) : (
              <Tree
                root={root}
                path={path}
                color={color}
                onPick={(depth, san) =>
                  setPicked([...path.slice(0, depth), san])
                }
              />
            )}

            <div className="qo-legend">
              <div className="qo-legend-keys">
                <span>
                  <i className="qo-dot qo-dot--good" /> 60% or more
                </span>
                <span>
                  <i className="qo-dot qo-dot--mid" /> 45 to 59%
                </span>
                <span>
                  <i className="qo-dot qo-dot--bad" /> under 45%
                </span>
                <span>
                  <i className="qo-dot qo-dot--few" /> too few games
                </span>
              </div>

              <span>Circle size = games played</span>
            </div>
          </section>

          <aside className="qo-side">
            <section className="qo-card">
              <div className="qo-eyebrow">Selected line</div>

              {selectedNode && path.length > 0 ? (
                <>
                  <div className="qo-sel">
                    <div className="qo-sel-text">
                      <h2 className="qo-name">
                        {openingName(path)}
                      </h2>

                      <div className="qo-line">
                        {lineLabel(path)}
                      </div>
                    </div>

                    <div className="qo-board qo-board--tree">
                      <Board
                        fen={fenForPath(path)}
                        flipped={color === "b"}
                        showCoords={false}
                      />
                    </div>
                  </div>

                  <div className="qo-stats">
                    <Ring
                      value={selectedNode.games}
                      percent={(selectedNode.games / Math.max(root.games, 1)) * 100}
                      label={selectedNode.games === 1 ? "game" : "games"}
                      tone="good"
                    />
                    <Ring
                      value={selectedNode.games >= 2 ? pct(selectedNode.score) : "–"}
                      percent={selectedNode.games >= 2 ? selectedNode.score * 100 : 0}
                      label="score"
                      tone={scoreClass(selectedNode)}
                    />
                    <Ring
                      value={stats?.accuracy != null ? Math.round(stats.accuracy) : "–"}
                      percent={stats?.accuracy ?? 0}
                      label="accuracy"
                      tone="mid"
                    />
                  </div>

                  {prepText && (
                    <p className="qo-prep">{prepText}</p>
                  )}

                  <div className="qo-actions">
                    <button
                      className="qo-btn qo-btn--primary"
                      onClick={() =>
                        go("Leak Lab", { line: path, color })
                      }
                    >
                      Practise this line
                    </button>

                    <button
                      className="qo-btn"
                      onClick={() => go("Games")}
                    >
                      Open games
                    </button>
                  </div>
                </>
              ) : (
                <p className="qo-note">
                  Tree mein koi chaal chuno.
                </p>
              )}
            </section>

            <section className="qo-card">
              <div className="qo-eyebrow">Gaps worth fixing</div>

              {gaps.length === 0 ? (
                <p className="qo-note">
                  Koi kamzor line nahi mili (3+ games aur 45% se
                  neeche wali). Ya abhi games kam hain.
                </p>
              ) : (
                <ul className="qo-gaps">
                  {gaps.map(({ path: p, node: n }) => {
                    const gapExit = nodeStats(n, data.records).exit;

                    return (
                      <li key={p.join(" ")}>
                        <button
                          className="qo-gap"
                          onClick={() => setPicked(p)}
                        >
                          <i className="qo-dot qo-dot--bad" />

                          <span className="qo-gap-name">
                            {openingName(p)} as {sideName(color)}
                          </span>

                          <span className="qo-meta">
                            {pct(n.score)} ·{" "}
                            {gapExit
                              ? `leaves book at move ${gapExit.move}`
                              : plural(n.games)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </aside>
        </div>
        </>
      )}
    </div>
  );
}

/* Openings page = left sidebar + content. Sidebar sections purane "qelvaris-subnavigate" event se chalte hain,
   isliye navbar dropdown aur sidebar dono ek hi tarah kaam karte hain. */
export default function Openings() {
  const [section, setSection] = useState("");

  return (
    <div className="qs-shell">
      <OpeningsSidebar
        active={section}
        onSelect={(id) =>
          window.dispatchEvent(
            new CustomEvent("qelvaris-subnavigate", {
              detail: { page: "Openings", section: id === "" ? "tree" : id },
            })
          )
        }
      />
      <div className="qs-main">
        <OpeningsPage onSection={setSection} />
      </div>
    </div>
  );
}
