import { useEffect, useMemo, useState } from "react";
import { getMiddlegames } from "./middlegameBuild";
import { loadProgress } from "./lessonStorage";
import "./Middlegames.css";

// Middlegame lessons ki list. openingName di ho toh sirf us opening ke lessons dikhte hain.
// onLearn(id) = Lab lesson, onPlay(id) = Match mein wahi position.

export default function MiddlegameList({ openingName = "", onLearn, onPlay, refreshKey = 0 }) {
  const all = getMiddlegames().list;
  const [progress, setProgress] = useState({});
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    let alive = true;
    loadProgress().then((p) => alive && setProgress(p));
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  const scoped = useMemo(() => (openingName ? all.filter((m) => m.opening === openingName) : all), [all, openingName]);
  const openings = useMemo(() => ["All", ...new Set(scoped.map((m) => m.opening))], [scoped]);
  const shown = filter === "All" || openingName ? scoped : scoped.filter((m) => m.opening === filter);

  if (scoped.length === 0) {
    return (
      <div className="qo-empty">
        <h3>No middlegame lessons for this opening yet</h3>
        <p>They are being added opening by opening.</p>
      </div>
    );
  }

  return (
    <div className="qm-list">
      {!openingName && openings.length > 2 && (
        <div className="qm-filters" role="group" aria-label="Opening">
          {openings.map((name) => (
            <button
              key={name}
              type="button"
              className={`qm-filter ${filter === name ? "is-on" : ""}`}
              aria-pressed={filter === name}
              onClick={() => setFilter(name)}
            >
              {name === "All" ? "All openings" : name}
            </button>
          ))}
        </div>
      )}

      <div className="qm-grid">
        {shown.map((m) => {
          const p = progress[m.id];
          return (
            <article className="qm-lesson" key={m.id}>
              <div className="qm-lesson-top">
                <span className="qo-mini-tag">{m.plan}</span>
                <span className="qo-meta">{m.level} · {m.side === "white" ? "as White" : "as Black"}</span>
              </div>
              {!openingName && <div className="qm-open">{m.opening}</div>}
              <h4>{m.title}</h4>
              <p>{m.learn}</p>
              <div className="qm-lesson-meta">
                <span>{m.steps.length} moves</span>
                {p && (
                  <span className="qm-done-badge">
                    ✓ Done{typeof p.best === "number" && p.best > 0 ? ` · best ${p.best}/${p.total}` : ""}
                  </span>
                )}
              </div>
              <div className="qm-lesson-actions">
                <button className="qo-btn qo-btn--primary" onClick={() => onLearn?.(m.id)}>
                  {p ? "Learn again" : "Learn"}
                </button>
                <button className="qo-btn" onClick={() => onPlay?.(m.id)}>Play this position</button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
