import { useEffect, useMemo, useRef, useState } from "react";
import { CATALOG, LEVELS, FAMILIES } from "./openingCatalog";
import { READY_NAMES } from "../explorer/openingRegistry";
import "./OpeningLibrary.css";

// Desktop opening library: search + level tabs + left filters + card grid.
// onOpen(opening) tab chalta hai jab ready opening ka "Open" dabta hai.

const EMPTY = { q: "", level: "All", side: "All", style: "All", fam: "All", ready: false };

function arrowsFor(str) {
  return str
    .split(" ")
    .map((mv, i) => ({
      x1: mv.charCodeAt(0) - 97 + 0.5,
      y1: 8 - Number(mv[1]) + 0.5,
      x2: mv.charCodeAt(2) - 97 + 0.5,
      y2: 8 - Number(mv[3]) + 0.5,
      color: i % 2 === 0 ? "#4fd1c5" : "#58c4f2",
    }))
    .slice(-3);
}

function MiniBoard({ arrows, size }) {
  return (
    <div className="ql-board" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 8 8">
        {arrows.map((a, i) => (
          <g key={i}>
            <line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} stroke="#111" strokeOpacity=".45" strokeWidth=".42" strokeLinecap="round" />
            <line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} stroke={a.color} strokeWidth=".26" strokeLinecap="round" />
            <circle cx={a.x2} cy={a.y2} r=".3" fill={a.color} stroke="#111" strokeOpacity=".45" strokeWidth=".08" />
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function OpeningLibrary({ onOpen }) {
  const [f, setF] = useState(EMPTY);
  const [sort, setSort] = useState("level");
  const searchRef = useRef(null);

  // "/" dabao toh search focus hota hai
  useEffect(() => {
    function onKey(e) {
      const tag = (e.target?.tagName || "").toLowerCase();
      if (e.key === "/" && tag !== "input" && tag !== "textarea") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const items = useMemo(() => CATALOG.map((o) => ({ ...o, ready: READY_NAMES.includes(o.name), arrowList: arrowsFor(o.arrows) })), []);
  const styles = useMemo(() => [...new Set(CATALOG.map((o) => o.style))].sort(), []);

  const pass = (o, skip) => {
    const q = f.q.trim().toLowerCase();
    if (skip !== "level" && f.level !== "All" && o.level !== f.level) return false;
    if (skip !== "side" && f.side !== "All" && o.side !== f.side) return false;
    if (skip !== "style" && f.style !== "All" && o.style !== f.style) return false;
    if (skip !== "fam" && f.fam !== "All" && o.fam !== f.fam) return false;
    if (skip !== "ready" && f.ready && !o.ready) return false;
    if (q) {
      const hay = `${o.name} ${o.eco} ${o.moves} ${o.style} ${o.side} ${o.level}`.toLowerCase();
      if (!q.split(/\s+/).every((w) => hay.includes(w))) return false;
    }
    return true;
  };

  const count = (key, value) => items.filter((o) => pass(o, key) && (value === "All" || o[key] === value)).length;

  const shown = items
    .filter((o) => pass(o, null))
    .sort((a, b) => {
      if (Boolean(a.ready) !== Boolean(b.ready)) return a.ready ? -1 : 1;
      if (sort === "az") return a.name.localeCompare(b.name);
      if (sort === "eco") return a.eco.localeCompare(b.eco);
      return LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level) || a.name.localeCompare(b.name);
    });

  const readyTotal = items.filter((o) => o.ready).length;
  const anyFilter = JSON.stringify(f) !== JSON.stringify(EMPTY);
  const set = (key, value) => setF((prev) => ({ ...prev, [key]: value }));

  function group(title, keyName, values, allLabel) {
    return (
      <div className="ql-group" key={keyName}>
        <div className="ql-group-title">{title}</div>
        {["All", ...values].map((v) => (
          <button
            key={v}
            type="button"
            className={`ql-opt ${f[keyName] === v ? "is-on" : ""}`}
            aria-pressed={f[keyName] === v}
            onClick={() => set(keyName, v)}
          >
            <span>{v === "All" ? allLabel : v}</span>
            <span className="ql-n">{count(keyName, v)}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="ql-root">
      <section className="ql-top">
        <div className="ql-top-main">
          <div className="ql-search-wrap">
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-4-4" />
            </svg>
            <input
              ref={searchRef}
              className="ql-search"
              type="text"
              aria-label="Search openings"
              placeholder="Search by name, ECO code or moves, e.g. Sicilian, B20, 1.d4"
              value={f.q}
              onChange={(e) => set("q", e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && set("q", "")}
            />
            <kbd className="ql-kbd">/</kbd>
          </div>
          <div className="ql-stats">
            <span><strong>{items.length}</strong> openings</span>
            <span><strong className="ql-amber">{readyTotal}</strong> ready to study</span>
            <span><strong>{shown.length}</strong> showing</span>
          </div>
        </div>
      </section>

      <div className="ql-body">
        <aside className="ql-side" aria-label="Filters">
          <div className="ql-side-head">
            <h3>Filters</h3>
            {anyFilter && (
              <button type="button" className="ql-btn ql-btn-ghost ql-small" onClick={() => setF(EMPTY)}>
                Clear all
              </button>
            )}
          </div>
          {group("Play as", "side", ["White", "Black"], "Both colours")}
          {group("First move", "fam", FAMILIES, "Any first move")}
          {group("Style", "style", styles, "All styles")}
          <div className="ql-group">
            <div className="ql-group-title">Availability</div>
            <button type="button" className={`ql-opt ${f.ready ? "is-on" : ""}`} aria-pressed={f.ready} onClick={() => set("ready", !f.ready)}>
              <span>Ready to study only</span>
              <span className="ql-n">{readyTotal}</span>
            </button>
          </div>
        </aside>

        <section className="ql-main" aria-label="Openings">
          <div className="ql-bar">
            <div className="ql-tabs" role="group" aria-label="Level">
              {["All", ...LEVELS].map((v) => (
                <button key={v} type="button" className={`ql-tab ${f.level === v ? "is-on" : ""}`} aria-pressed={f.level === v} onClick={() => set("level", v)}>
                  {v === "All" ? "All levels" : v} <span className="ql-n">{count("level", v)}</span>
                </button>
              ))}
            </div>
            <div className="ql-tabs" role="group" aria-label="Sort">
              <span className="ql-sort-label">Sort</span>
              {[["level", "Level"], ["az", "A–Z"], ["eco", "ECO"]].map(([k, label]) => (
                <button key={k} type="button" className={`ql-tab ql-tab-sm ${sort === k ? "is-on" : ""}`} aria-pressed={sort === k} onClick={() => setSort(k)}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div aria-live="polite" className="ql-sr">{shown.length} openings shown</div>

          {shown.length === 0 ? (
            <div className="ql-empty">
              <h3>No opening matches these filters</h3>
              <p>Try a different search word or remove a filter.</p>
              <button type="button" className="ql-btn ql-btn-primary" onClick={() => setF(EMPTY)}>Clear all filters</button>
            </div>
          ) : (
            <div className="ql-grid">
              {shown.map((o) => (
                <article key={o.name} className={`ql-card ${o.ready ? "" : "is-soon"}`}>
                  <MiniBoard arrows={o.arrowList} size={96} />
                  <div className="ql-card-body">
                    <div className="ql-card-info">
                    <div className="ql-card-row">
                      <span className="ql-eco">{o.eco}</span>
                      <span className={`ql-pill ql-${o.level.toLowerCase()}`}>{o.level}</span>
                    </div>
                    <h3>{o.name}</h3>
                    <div className="ql-moves">{o.moves}</div>
                    <div className="ql-tags">
                      <span className="ql-tag">{o.side}</span>
                      <span className="ql-tag">{o.style}</span>
                    </div>
                    </div>
                    <div className="ql-card-foot">
                      {o.ready ? (
                        <button type="button" className="ql-btn ql-btn-primary" aria-label={`Open ${o.name}`} onClick={() => onOpen?.(o)}>
                          Study this opening <span aria-hidden="true">→</span>
                        </button>
                      ) : (
                        <button type="button" className="ql-btn ql-btn-ghost" disabled>
                          Coming soon
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
