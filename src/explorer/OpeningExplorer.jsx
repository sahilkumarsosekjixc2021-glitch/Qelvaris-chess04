import { Component, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Board from "../Board";
import { buildOpening, moveLabel } from "./openingTreeBuild";
import { getOpeningDef } from "./openingRegistry";
import { loadSavedVariations, toggleSavedVariation } from "./learningStorage";
import MiddlegameList from "../middlegames/MiddlegameList";
import { middlegamesFor } from "../middlegames/middlegameBuild";
import "../middlegames/Middlegames.css";
import "./OpeningExplorer.css";

/* Har opening ka tree ek baar banta hai (cache). Fail ho toh page crash nahi hoga, sirf message dikhega. */
const CACHE = new Map();

function getBuilt(name) {
  if (CACHE.has(name)) return CACHE.get(name);
  let result;
  try {
    const def = getOpeningDef(name);
    if (!def) throw new Error(`No data for opening "${name}"`);
    const built = buildOpening(def);
    if (built.warnings.length) console.warn("[OpeningExplorer] skipped illegal moves:", built.warnings);
    result = { def, built, error: null };
  } catch (err) {
    console.error("[OpeningExplorer] tree build failed:", err);
    result = { def: null, built: null, error: err };
  }
  CACHE.set(name, result);
  return result;
}

class Guard extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err) {
    console.error("[OpeningExplorer] crashed:", err);
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="qo-empty">
          <h3>Explorer could not load</h3>
          <p>Your opening tree and other pages are not affected.</p>
          <button className="qo-btn" onClick={this.props.onBack}>
            ← Back to openings
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function CriticalCard({ critical }) {
  const [picked, setPicked] = useState(null);

  return (
    <section className="qx-card qx-critical">
      <div className="qo-eyebrow">Critical position · your turn</div>
      <h4>{critical.question}</h4>

      <div className="qx-options">
        {critical.options.map((option, index) => {
          const chosen = picked === index;
          const show = picked !== null;
          return (
            <button
              key={option.text}
              className={`qx-option ${show && chosen ? `is-${option.rating}` : ""}`}
              disabled={show}
              onClick={() => setPicked(index)}
            >
              {option.text}
            </button>
          );
        })}
      </div>

      {picked !== null && (
        <div className={`qx-feedback is-${critical.options[picked].rating}`}>
          <strong>
            {critical.options[picked].rating === "main"
              ? "Good choice."
              : critical.options[picked].rating === "risky"
                ? "Playable, but risky."
                : "Not the best idea."}
          </strong>{" "}
          {critical.options[picked].why}
          <button className="qx-link" onClick={() => setPicked(null)}>
            Try again
          </button>
        </div>
      )}
    </section>
  );
}

function ExplorerInner({ onBack, def, built, onLearnLesson, onPlayMiddlegame }) {
  const [tab, setTab] = useState("variations");
  const mgCount = middlegamesFor(def.name).length;
  const [selectedId, setSelectedId] = useState(built.trunkEndId);
  const [open, setOpen] = useState(() => new Set([built.trunkEndId]));
  const [saved, setSaved] = useState([]);
  const treeRef = useRef(null);

  useEffect(() => {
    let alive = true;
    loadSavedVariations().then((list) => {
      if (alive) setSaved(list);
    });
    return () => {
      alive = false;
    };
  }, []);

  const selected = built.nodes.get(selectedId);

  const select = useCallback(
    (id) => {
      const node = built.nodes.get(id);
      if (!node) return;
      setSelectedId(id);
      setOpen((prev) => {
        const next = new Set(prev);
        let cur = node;
        while (cur) {
          next.add(cur.id);
          cur = cur.parentId === null ? null : built.nodes.get(cur.parentId);
        }
        return next;
      });
    },
    [built]
  );

  const goBack = useCallback(() => {
    const node = built.nodes.get(selectedId);
    if (node && node.parentId !== null) setSelectedId(node.parentId);
  }, [built, selectedId]);

  const goForward = useCallback(() => {
    const node = built.nodes.get(selectedId);
    if (node?.childIds.length) select(node.childIds[0]);
  }, [built, selectedId, select]);

  useEffect(() => {
    function onKey(e) {
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goBack();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goForward();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goBack, goForward]);

  // Line chips: root se selected tak
  const lineNodes = useMemo(() => {
    const list = [];
    let cur = selected;
    while (cur && cur.parentId !== null) {
      list.unshift(cur);
      cur = built.nodes.get(cur.parentId);
    }
    return list;
  }, [built, selected]);

  // Sabse paas ki info: selected se upar tak
  const infoNode = useMemo(() => {
    let cur = selected;
    while (cur) {
      if (cur.info) return cur;
      cur = cur.parentId === null ? null : built.nodes.get(cur.parentId);
    }
    return null;
  }, [built, selected]);

  const breadcrumb = useMemo(
    () =>
      lineNodes
        .filter((node) => node.info?.name)
        .map((node) => node.info.name),
    [lineNodes]
  );

  // selected tak ke saare node ids (tree mein path highlight ke liye)
  const pathIds = useMemo(() => new Set(lineNodes.map((node) => node.id)), [lineNodes]);

  // Har node ke neeche kitni alag lines hain (leaf count)
  const leafCount = useMemo(() => {
    const memo = new Map();
    const count = (id) => {
      if (memo.has(id)) return memo.get(id);
      const node = built.nodes.get(id);
      const value = node.childIds.length ? node.childIds.reduce((sum, kid) => sum + count(kid), 0) : 1;
      memo.set(id, value);
      return value;
    };
    count(built.trunkEndId);
    return count;
  }, [built]);

  const nextMoves = selected.childIds.map((id) => built.nodes.get(id));

  // Is line ke end par: sabse paas ka branch jahan doosra raasta tha
  const lastBranchId = useMemo(() => {
    let cur = selected;
    while (cur && cur.parentId !== null) {
      const parent = built.nodes.get(cur.parentId);
      if (parent && parent.childIds.length > 1) return parent.id;
      cur = parent;
    }
    return null;
  }, [built, selected]);

  const expandAll = useCallback(() => {
    const all = new Set();
    built.nodes.forEach((node) => {
      if (node.childIds.length) all.add(node.id);
    });
    setOpen(all);
  }, [built]);

  const collapseAll = useCallback(() => {
    setOpen(new Set([built.trunkEndId]));
  }, [built]);

  // Selected row hamesha tree panel mein dikhe
  useEffect(() => {
    const box = treeRef.current;
    if (!box) return;
    const el = Array.from(box.querySelectorAll("[data-nid]")).find((item) => item.dataset.nid === selectedId);
    if (!el) return;
    const boxRect = box.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    if (rect.top < boxRect.top + 40) box.scrollTop -= boxRect.top + 40 - rect.top;
    else if (rect.bottom > boxRect.bottom - 20) box.scrollTop += rect.bottom - boxRect.bottom + 20;
  }, [selectedId, open]);

  const transpositions = (built.byKey.get(selected.key) || []).filter(
    (id) => id !== selected.id
  );

  const isSaved = saved.some(
    (item) => item.id === selected.id && item.openingId === built.openingId
  );

  async function onToggleSave() {
    if (!selected.id) return;
    try {
      const label = breadcrumb.length ? breadcrumb[breadcrumb.length - 1] : def.name;
      const next = await toggleSavedVariation({
        id: selected.id,
        openingId: built.openingId,
        label: `${label} · ${moveLabel(selected.ply, selected.san)}`,
      });
      setSaved(next);
    } catch (err) {
      console.error("Could not save variation:", err);
    }
  }

  function toggleOpen(id) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Bina branch wali lambi chaalein ek hi row mein jud jaati hain (run)
  function runFrom(id) {
    const ids = [id];
    let cur = built.nodes.get(id);
    while (cur.childIds.length === 1) {
      const next = built.nodes.get(cur.childIds[0]);
      if (next.info || next.critical) break;
      ids.push(next.id);
      cur = next;
    }
    return ids;
  }

  function renderRows(ids, depth) {
    return ids.map((id) => {
      const run = runFrom(id);
      const head = built.nodes.get(run[0]);
      const tail = built.nodes.get(run[run.length - 1]);
      const hasKids = tail.childIds.length > 0;
      const isOpen = open.has(tail.id);
      const active = run.includes(selectedId);
      const onPath = run.some((rid) => pathIds.has(rid));
      const hasCritical = run.some((rid) => built.nodes.get(rid).critical);
      return (
        <li key={id}>
          <div
            data-nid={active ? selectedId : run[0]}
            className={`qx-row ${active ? "is-active" : ""} ${onPath && !active ? "is-path" : ""}`}
            style={{ paddingLeft: 6 + depth * 14 }}
          >
            {hasKids ? (
              <button
                className="qx-toggle"
                aria-label={isOpen ? "Collapse" : "Expand"}
                aria-expanded={isOpen}
                onClick={() => toggleOpen(tail.id)}
              >
                {isOpen ? "▾" : "▸"}
              </button>
            ) : (
              <span className="qx-toggle qx-toggle--empty" />
            )}
            <div className="qx-run">
              {head.info?.name && <span className="qx-runname">{head.info.name}</span>}
              <div className="qx-runmoves">
                {run.map((rid, index) => {
                  const node = built.nodes.get(rid);
                  const white = node.ply % 2 === 1;
                  return (
                    <button
                      key={rid}
                      className={`qx-m ${rid === selectedId ? "is-current" : ""}`}
                      onClick={() => select(rid)}
                    >
                      {index === 0 || white ? moveLabel(node.ply, node.san) : node.san}
                    </button>
                  );
                })}
                {hasCritical && (
                  <span className="qx-badge" title="Critical position">
                    ?
                  </span>
                )}
                {hasKids && !isOpen && <span className="qx-count">{leafCount(tail.id)} lines</span>}
              </div>
            </div>
          </div>
          {hasKids && isOpen && <ul className="qx-list">{renderRows(tail.childIds, depth + 1)}</ul>}
        </li>
      );
    });
  }

  const trunkEnd = built.nodes.get(built.trunkEndId);
  const trunkText = def.trunk
    .split(" ")
    .map((san, i) => (i % 2 === 0 ? `${i / 2 + 1}.${san}` : san))
    .join(" ");
  const lastMove = selected.uci
    ? { from: selected.uci.slice(0, 2), to: selected.uci.slice(2, 4) }
    : null;

  return (
    <div className="qx">
      <div className="qx-top">
        <div>
          <div className="qo-eyebrow">Opening workspace</div>
          <h2>{def.name}</h2>
          <div className="qx-trunk">{trunkText}</div>
        </div>
        <button className="qo-btn" onClick={onBack}>
          ← Back to openings
        </button>
      </div>

      <div className="qm-tabs qx-tabs" role="tablist" aria-label="Opening sections">
        <button role="tab" aria-selected={tab === "variations"} className={`qm-tab ${tab === "variations" ? "is-on" : ""}`} onClick={() => setTab("variations")}>
          Variations
        </button>
        <button role="tab" aria-selected={tab === "middlegames"} className={`qm-tab ${tab === "middlegames" ? "is-on" : ""}`} onClick={() => setTab("middlegames")}>
          Middlegames{mgCount ? ` (${mgCount})` : ""}
        </button>
      </div>

      {tab === "middlegames" ? (
        <MiddlegameList openingName={def.name} onLearn={onLearnLesson} onPlay={onPlayMiddlegame} />
      ) : (
      <div className="qx-layout">
        {/* Tree */}
        <aside className="qx-card qx-tree" ref={treeRef}>
          <div className="qx-tree-head">
            <div className="qo-eyebrow">Variations</div>
            <div className="qx-tree-tools">
              <button className="qx-link" onClick={expandAll}>
                Expand all
              </button>
              <button className="qx-link" onClick={collapseAll}>
                Collapse
              </button>
            </div>
          </div>
          <ul className="qx-list qx-list--root">
            <li>
              <div data-nid={trunkEnd.id} className={`qx-row ${selectedId === trunkEnd.id ? "is-active" : ""}`}>
                <span className="qx-toggle qx-toggle--empty" />
                <button className="qx-move" onClick={() => select(trunkEnd.id)}>
                  <span className="qx-san">{moveLabel(trunkEnd.ply, trunkEnd.san)}</span>
                  <span className="qx-name">{def.name}</span>
                </button>
              </div>
              {open.has(trunkEnd.id) && (
                <ul className="qx-list">{renderRows(trunkEnd.childIds, 1)}</ul>
              )}
            </li>
          </ul>
          <p className="qo-note">Use ← → keys to move along the line. A "?" marks a critical position.</p>
        </aside>

        {/* Board */}
        <section className="qx-board-col">
          <div className="qx-board">
            <Board fen={selected.fen} showCoords lastMove={lastMove} flipped={def.side === "Black"} />
          </div>

          <div className="qo-board-controls">
            <button className="qo-btn" disabled={selected.parentId === null} onClick={() => setSelectedId("")}>
              ⏮ Start
            </button>
            <button className="qo-btn" disabled={selected.parentId === null} onClick={goBack}>
              ← Back
            </button>
            <button className="qo-btn qo-btn--primary" disabled={!selected.childIds.length} onClick={goForward}>
              Next →
            </button>
            <button
              className={`qo-btn ${isSaved ? "qx-saved" : ""}`}
              disabled={!selected.id}
              onClick={onToggleSave}
            >
              {isSaved ? "★ Saved" : "☆ Save variation"}
            </button>
          </div>

          <div className="qx-line">
            {lineNodes.length === 0 && <span className="qo-meta">Starting position</span>}
            {lineNodes.map((node) => (
              <button
                key={node.id}
                className={`qx-chip ${node.id === selectedId ? "is-current" : ""}`}
                onClick={() => setSelectedId(node.id)}
              >
                {moveLabel(node.ply, node.san)}
              </button>
            ))}
          </div>

          <section className="qx-next">
            <div className="qo-eyebrow">{nextMoves.length ? "Next moves from here" : "End of this line"}</div>
            {nextMoves.length > 0 ? (
              <div className="qx-next-grid">
                {nextMoves.map((node, index) => (
                  <button key={node.id} className="qx-next-btn" onClick={() => select(node.id)}>
                    <span className="qx-next-move">{moveLabel(node.ply, node.san)}</span>
                    <span className="qx-next-name">{node.info?.name || (index === 0 ? "Main continuation" : "Alternative")}</span>
                    <span className="qx-next-meta">
                      {index === 0 && <span className="qx-next-tag">main</span>}
                      {node.critical && <span className="qx-next-tag qx-next-tag--q">?</span>}
                      <span>{leafCount(node.id)} {leafCount(node.id) === 1 ? "line" : "lines"}</span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="qx-next-end">
                <p className="qo-note">You reached the end of this prepared line. Try another branch or go back to a position with more than one reply.</p>
                {lastBranchId !== null && (
                  <button className="qo-btn" onClick={() => select(lastBranchId)}>
                    ↩ Back to last branch
                  </button>
                )}
              </div>
            )}
          </section>
        </section>

        {/* Explanation */}
        <aside className="qx-side">
          {breadcrumb.length > 0 && (
            <div className="qx-crumbs">
              {breadcrumb.map((name, index) => (
                <span key={`${name}-${index}`}>{name}</span>
              ))}
            </div>
          )}

          {infoNode ? (
            <section className="qx-card">
              <div className="qx-info-head">
                <h3>{infoNode.info.name || "Position notes"}</h3>
                {infoNode.info.level && <span className="qo-mini-tag">{infoNode.info.level}</span>}
              </div>

              {infoNode.info.idea && (
                <div className="qx-block">
                  <strong>The idea</strong>
                  <p>{infoNode.info.idea}</p>
                </div>
              )}
              {infoNode.info.white && (
                <div className="qx-block">
                  <strong>White's plan</strong>
                  <p>{infoNode.info.white}</p>
                </div>
              )}
              {infoNode.info.black && (
                <div className="qx-block">
                  <strong>Black's plan</strong>
                  <p>{infoNode.info.black}</p>
                </div>
              )}
              {infoNode.info.watch && (
                <div className="qx-block qx-block--tip">
                  <strong>Watch out</strong>
                  <p>{infoNode.info.watch}</p>
                </div>
              )}
              {infoNode.info.middlegame && (
                <div className="qx-block">
                  <strong>Typical middlegame</strong>
                  <p>{infoNode.info.middlegame}</p>
                </div>
              )}
              {infoNode.info.structures && (
                <div className="qx-block">
                  <strong>Pawn structures</strong>
                  <p>{infoNode.info.structures}</p>
                </div>
              )}
              {infoNode.info.mistakes && (
                <div className="qx-block">
                  <strong>Common mistakes</strong>
                  <p>{infoNode.info.mistakes}</p>
                </div>
              )}
            </section>
          ) : (
            <section className="qx-card">
              <p className="qo-note">Pick a variation on the left to see its ideas.</p>
            </section>
          )}

          {selected.critical && <CriticalCard key={selected.id} critical={selected.critical} />}

          {transpositions.length > 0 && (
            <section className="qx-card">
              <div className="qo-eyebrow">Transposition</div>
              <p className="qo-note">The same position can also be reached by this move order:</p>
              <div className="qx-line">
                {transpositions.map((id) => (
                  <button key={id} className="qx-chip" onClick={() => select(id)}>
                    {built.nodes.get(id).path
                      .map((san, i) => (i % 2 === 0 ? `${i / 2 + 1}.${san}` : san))
                      .join(" ")}
                  </button>
                ))}
              </div>
            </section>
          )}

          {saved.length > 0 && (
            <section className="qx-card">
              <div className="qo-eyebrow">Saved variations</div>
              <ul className="qx-saved-list">
                {saved
                  .filter((item) => item.openingId === built.openingId && built.nodes.has(item.id))
                  .map((item) => (
                    <li key={item.id}>
                      <button className="qx-link" onClick={() => select(item.id)}>
                        {item.label}
                      </button>
                    </li>
                  ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
      )}
    </div>
  );
}

export default function OpeningExplorer({ onBack, opening = "Italian Game", onLearnLesson, onPlayMiddlegame }) {
  const { def, built, error } = getBuilt(opening);

  if (!built) {
    return (
      <div className="qo-empty">
        <h3>Explorer data could not be built</h3>
        <p>{String(error?.message || "Unknown error")}</p>
        <button className="qo-btn" onClick={onBack}>
          ← Back to openings
        </button>
      </div>
    );
  }

  return (
    <Guard onBack={onBack}>
      <ExplorerInner key={def.id} onBack={onBack} def={def} built={built} onLearnLesson={onLearnLesson} onPlayMiddlegame={onPlayMiddlegame} />
    </Guard>
  );
}
