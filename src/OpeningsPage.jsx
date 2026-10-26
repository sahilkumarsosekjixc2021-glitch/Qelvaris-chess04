import { useCallback, useEffect, useMemo, useState } from "react";
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
import "./Openings.css";

function go(page, extra = {}) {
  window.dispatchEvent(new CustomEvent("qelvaris-navigate", { detail: { page, ...extra } }));
}

const pct = (score) => `${Math.round(score * 100)}%`;
const plural = (n) => `${n} game${n === 1 ? "" : "s"}`;
const sideName = (color) => (color === "w" ? "White" : "Black");

function moveLabel(ply, san) {
  const number = Math.ceil(ply / 2);
  return ply % 2 === 1 ? `${number}.${san}` : `${number}…${san}`;
}

/* ---------- Tree ko circles aur lines mein jamana ---------- */

const ROW = 98;
const STEP = 210;
const X0 = 84;

function layoutTree(root, path) {
  const columns = [];
  let node = root;

  for (let depth = 0; node && depth <= path.length && depth < MAX_PLIES; depth += 1) {
    if (!node.children.length) break;
    columns.push({ nodes: node.children, selected: path[depth] });
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
    if (top + (n - 1) * ROW > bottomLimit) top = bottomLimit - (n - 1) * ROW;
    if (top < 48) top = 48;

    const items = col.nodes.map((node2, j) => ({ node: node2, x: X0 + depth * STEP, y: top + j * ROW }));
    placed.push({ items, selected: col.selected });

    const chosen = items.find((it) => it.node.san === col.selected);
    parentY = chosen ? chosen.y : parentY;
  });

  return { placed, width: X0 + Math.max(0, columns.length - 1) * STEP + 130, height };
}

function Tree({ root, path, color, onPick }) {
  const { placed, width, height } = useMemo(() => layoutTree(root, path), [root, path]);
  const rootGames = Math.max(root.games, 1);
  const radius = (games) => 8 + 28 * Math.sqrt(games / rootGames);

  // Naam sirf tab dikhao jab is chaal par opening ka naam badalta ho
  const nameFor = (depthIndex, node) => {
    const chain = [...path.slice(0, depthIndex), node.san];
    if (chain.length < 3) return ""; // "1.e4 King's Pawn Game" jaisa lamba naam nahi
    const here = openingName(chain);
    const before = depthIndex > 0 ? openingName(path.slice(0, depthIndex)) : "";
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
        {placed.map((col, depth) => {
          if (depth === 0) return null;
          const parent = placed[depth - 1].items.find((it) => it.node.san === placed[depth - 1].selected);
          if (!parent) return null;
          return col.items.map((it) => (
            <line key={`e-${depth}-${it.node.san}`} x1={parent.x} y1={parent.y} x2={it.x} y2={it.y} className="qo-edge" />
          ));
        })}

        {placed.map((col, depth) =>
          col.items.map((it) => {
            const cls = scoreClass(it.node);
            const r = radius(it.node.games);
            const isSel = col.selected === it.node.san;
            const extra = nameFor(depth, it.node);
            const label = `${moveLabel(it.node.ply, it.node.san)}${extra ? ` ${extra}` : ""}`;
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
                {isSel && <circle cx={it.x} cy={it.y} r={r + 8} className="qo-halo" />}
                <circle cx={it.x} cy={it.y} r={r} className={`qo-c qo-c--${cls}`} />
                <text x={it.x} y={it.y + r + 17} textAnchor="middle" className="qo-t1">
                  {label}
                </text>
                <text x={it.x} y={it.y + r + 32} textAnchor="middle" className="qo-t2">
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
        Tree banane ke liye pata hona chahiye ki har game mein aap White the ya Black. Apne Lichess / Chess.com naam daalo (comma se alag).
      </p>
      <div className="qo-form">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="jaise: ravi_chess, ravi88"
          aria-label="Your usernames"
        />
        <button className="qo-btn qo-btn--primary" onClick={() => onSave(text.split(",").map((s) => s.trim()).filter(Boolean))}>
          Save
        </button>
      </div>
    </section>
  );
}

export default function Openings() {
  const [data, setData] = useState(null);
  const [names, setNames] = useState([]);
  const [error, setError] = useState("");
  const [color, setColor] = useState("w");
  const [picked, setPicked] = useState(null); // null = sabse aam line khud khuli rahe

  const load = useCallback(async () => {
    try {
      const [built, saved] = await Promise.all([buildTrees(), getUsernames()]);
      setData(built);
      setNames(saved);
    } catch (err) {
      console.error("Openings load failed:", err);
      setError("Openings load nahi ho payi. Page refresh karke dekho.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onSaveNames(list) {
    await saveUsernames(list);
    setPicked(null);
    await load();
  }

  const root = data?.trees[color];
  const path = useMemo(() => picked ?? (root ? defaultPath(root) : []), [picked, root]);
  const selectedNode = useMemo(() => (root ? nodeAt(root, path) : null), [root, path]);
  const gaps = useMemo(() => (root ? findGaps(root) : []), [root]);

  const stats = useMemo(
    () => (data && selectedNode && path.length ? nodeStats(selectedNode, data.records) : null),
    [data, selectedNode, path]
  );

  if (error) return <div className="qo-page"><p className="qo-note">{error}</p></div>;
  if (!data) return <div className="qo-page"><p className="qo-note">Loading…</p></div>;

  const total = data.usedCount.w + data.usedCount.b;
  const isWeakest = gaps.length > 0 && gaps[0].path.join(" ") === path.join(" ");

  const prepText = !stats
    ? ""
    : stats.exit
      ? `You leave your preparation at move ${stats.exit.move} in ${stats.exit.count} of ${stats.reviewed} reviewed ${stats.reviewed === 1 ? "game" : "games"}.${isWeakest ? ` This is your weakest ${sideName(color)} line.` : ""}`
      : "Review these games to see where you leave your preparation.";

  return (
    <div className="qo-page">
      {total === 0 && <UsernameCard names={names} onSave={onSaveNames} highlight />}

      {total > 0 && (
        <div className="qo-layout">
          <section className="qo-card qo-treecard">
            <div className="qo-cardhead">
              <div className="qo-eyebrow">Your opening tree · as {sideName(color)}</div>
              <div className="qo-tabs" role="tablist">
                {[["w", "As White"], ["b", "As Black"]].map(([id, label]) => (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={color === id}
                    className={`qo-tab ${color === id ? "is-active" : ""}`}
                    onClick={() => {
                      setColor(id);
                      setPicked(null);
                    }}
                  >
                    {label} <span className="qo-n">{data.usedCount[id]}</span>
                  </button>
                ))}
              </div>
            </div>

            {root.children.length === 0 ? (
              <p className="qo-note">Is rang mein abhi koi game nahi.</p>
            ) : (
              <Tree
                root={root}
                path={path}
                color={color}
                onPick={(depth, san) => setPicked([...path.slice(0, depth), san])}
              />
            )}

            <div className="qo-legend">
              <div className="qo-legend-keys">
                <span><i className="qo-dot qo-dot--good" /> 60% or more</span>
                <span><i className="qo-dot qo-dot--mid" /> 45 to 59%</span>
                <span><i className="qo-dot qo-dot--bad" /> under 45%</span>
                <span><i className="qo-dot qo-dot--few" /> too few games</span>
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
                      <h2 className="qo-name">{openingName(path)}</h2>
                      <div className="qo-line">{lineLabel(path)}</div>
                    </div>
                    <div className="qo-board">
                      <Board fen={fenForPath(path)} flipped={color === "b"} showCoords={false} />
                    </div>
                  </div>

                  <div className="qo-stats">
                    <div><strong>{selectedNode.games}</strong><span>{selectedNode.games === 1 ? "game" : "games"}</span></div>
                    <div><strong>{selectedNode.games >= 2 ? pct(selectedNode.score) : "–"}</strong><span>score</span></div>
                    <div><strong>{stats?.accuracy != null ? Math.round(stats.accuracy) : "–"}</strong><span>accuracy</span></div>
                  </div>

                  {prepText && <p className="qo-prep">{prepText}</p>}

                  <div className="qo-actions">
                    <button className="qo-btn qo-btn--primary" onClick={() => go("Leak Lab", { line: path, color })}>
                      Practise this line
                    </button>
                    <button className="qo-btn" onClick={() => go("Games")}>
                      Open games
                    </button>
                  </div>
                </>
              ) : (
                <p className="qo-note">Tree mein koi chaal chuno.</p>
              )}
            </section>

            <section className="qo-card">
              <div className="qo-eyebrow">Gaps worth fixing</div>
              {gaps.length === 0 ? (
                <p className="qo-note">Koi kamzor line nahi mili (3+ games aur 45% se neeche wali). Ya abhi games kam hain.</p>
              ) : (
                <ul className="qo-gaps">
                  {gaps.map(({ path: p, node: n }) => {
                    const gapExit = nodeStats(n, data.records).exit;
                    return (
                      <li key={p.join(" ")}>
                        <button className="qo-gap" onClick={() => setPicked(p)}>
                          <i className="qo-dot qo-dot--bad" />
                          <span className="qo-gap-name">
                            {openingName(p)} as {sideName(color)}
                          </span>
                          <span className="qo-meta">
                            {pct(n.score)} · {gapExit ? `leaves book at move ${gapExit.move}` : plural(n.games)}
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
      )}

      {total > 0 && (data.noColor > 0 || data.noMoves > 0) && (
        <p className="qo-note qo-foot">
          {data.noColor > 0 && `${data.noColor} games mein aapka rang pata nahi chala (username check karo). `}
          {data.noMoves > 0 && `${data.noMoves} games mein moves nahi mile.`}
        </p>
      )}

      {total > 0 && <UsernameCard names={names} onSave={onSaveNames} />}
    </div>
  );
}