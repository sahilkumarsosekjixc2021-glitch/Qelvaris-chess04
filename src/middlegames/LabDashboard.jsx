import { useEffect, useMemo, useState } from "react";
import Board from "../Board";
import { getMiddlegames } from "./middlegameBuild";
import { loadProgress, loadSavedLessons, toggleSavedLesson } from "./lessonStorage";
import ChipRow from "../shell/ChipRow";
import "./LabDashboard.css";

// Middlegame Lab ka dashboard: hero banner, opening chips, lesson cards (thumbnail + Learn/Play), pagination.
// Sab data asli hai (lessons, progress, saved). Banner ka king CSS/SVG se bana hai, koi bahar ki image nahi.

const PAGE_SIZE = 9;
const VISIBLE_CHIPS = 5;
const LEVELS = ["All", "Beginner", "Intermediate", "Expert"];
const STATUS = [
  ["all", "All"],
  ["todo", "Not done"],
  ["done", "Done"],
  ["saved", "Saved"],
];

export function LabHero({ mode, onMode, onBack, compact = false }) {
  return (
    <section className="ld-hero ld-hero--img">
      <div className="ld-hero-art" aria-hidden="true" />
      <div className="ld-hero-copy">
        <h2>
          Middlegame <span>Lab</span>
        </h2>
        <p>Start from a real middlegame, guess the next move and learn why it works.</p>
        <div className="ld-hero-actions">
          <button type="button" className={`ld-mode ${mode === "lessons" ? "is-on" : ""}`} onClick={() => onMode("lessons")}>
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M8 5l11 7-11 7z" fill="currentColor" /></svg>
            Coach lessons
          </button>
          <button type="button" className={`ld-mode ${mode === "think" ? "is-on" : ""}`} onClick={() => onMode("think")}>
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M5 20V11M12 20V5M19 20v-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" /></svg>
            Think it through
          </button>
        </div>
      </div>
    </section>
  );
}

function Thumb({ fen, flipped }) {
  return (
    <div className="ld-thumb" aria-hidden="true">
      <Board fen={fen} flipped={flipped} showCoords={false} />
    </div>
  );
}

export default function LabDashboard({ mode, onMode, onBack, onLearn, onPlay, refreshKey = 0 }) {
  const all = getMiddlegames().list;
  const [progress, setProgress] = useState({});
  const [saved, setSaved] = useState([]);
  const [opening, setOpening] = useState("All");
  const [level, setLevel] = useState("All");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);

  useEffect(() => {
    let alive = true;
    Promise.all([loadProgress(), loadSavedLessons()]).then(([p, s]) => {
      if (!alive) return;
      setProgress(p);
      setSaved(s);
    });
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  const openings = useMemo(() => {
    const counts = new Map();
    for (const m of all) counts.set(m.opening, (counts.get(m.opening) || 0) + 1);
    return [...counts.entries()].map(([name, count]) => ({ name, count }));
  }, [all]);

  const shown = useMemo(
    () =>
      all.filter((m) => {
        if (opening !== "All" && m.opening !== opening) return false;
        if (level !== "All" && m.level !== level) return false;
        if (status === "done" && !progress[m.id]) return false;
        if (status === "todo" && progress[m.id]) return false;
        if (status === "saved" && !saved.includes(m.id)) return false;
        return true;
      }),
    [all, opening, level, status, progress, saved]
  );

  const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const slice = shown.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const minutes = Math.max(1, Math.round(shown.reduce((sum, m) => sum + m.steps.length * 0.7, 0)));
  const next = shown.find((m) => !progress[m.id]) || shown[0];

  function pick(setter) {
    return (value) => {
      setter(value);
      setPage(0);
    };
  }

  async function onSave(id) {
    try {
      setSaved(await toggleSavedLesson(id));
    } catch (err) {
      console.error("Could not save lesson:", err);
    }
  }

  return (
    <div className="ld">
      <LabHero mode={mode} onMode={onMode} onBack={onBack} />

      <ChipRow items={openings} total={all.length} value={opening} onChange={pick(setOpening)} visible={VISIBLE_CHIPS} />

      <div className="ld-filters">
        <div className="ld-seg" role="group" aria-label="Level">
          {LEVELS.map((l) => (
            <button key={l} type="button" className={level === l ? "is-on" : ""} aria-pressed={level === l} onClick={() => pick(setLevel)(l)}>
              {l === "All" ? "All levels" : l}
            </button>
          ))}
        </div>
        <div className="ld-seg" role="group" aria-label="Status">
          {STATUS.map(([id, label]) => (
            <button key={id} type="button" className={status === id ? "is-on" : ""} aria-pressed={status === id} onClick={() => pick(setStatus)(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="qo-empty">
          <h3>No lessons match these filters</h3>
          <p>{status === "saved" ? "Tap the bookmark on a lesson to save it for later." : "Try another opening or level."}</p>
        </div>
      ) : (
        <div className="ld-grid">
          {slice.map((m) => {
            const p = progress[m.id];
            const isSaved = saved.includes(m.id);
            return (
              <article className="ld-card" key={m.id}>
                <div className="ld-card-top">
                  <span className="ld-plan">{m.plan}</span>
                  <span className="ld-lvl">
                    {m.level} · {m.side === "white" ? "White" : "Black"}
                  </span>
                </div>
                <div className="ld-card-body">
                  <Thumb fen={m.startFen} flipped={m.side === "black"} />
                  <div className="ld-card-text">
                    <div className="ld-open">{m.opening}</div>
                    <h4>{m.title}</h4>
                    <p>{m.learn}</p>
                    <div className="ld-meta">
                      <span>{m.steps.length} moves</span>
                      {p && <span className="ld-done">✓ Done{typeof p.best === "number" && p.best > 0 ? ` · best ${p.best}/${p.total}` : ""}</span>}
                    </div>
                  </div>
                </div>
                <div className="ld-actions">
                  <button type="button" className="ld-learn" onClick={() => onLearn?.(m.id)}>
                    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M8 5l11 7-11 7z" fill="currentColor" /></svg>
                    {p ? "Replay" : "Learn"}
                  </button>
                  <button type="button" className="ld-play" onClick={() => onPlay?.(m.id)}>
                    Play position
                  </button>
                  <button type="button" className={`ld-save ${isSaved ? "is-on" : ""}`} aria-pressed={isSaved} aria-label={isSaved ? "Remove from saved" : "Save lesson"} title={isSaved ? "Saved" : "Save for later"} onClick={() => onSave(m.id)}>
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M7 4h10v16l-5-3.5L7 20z" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="ld-foot">
        <div className="ld-count">
          {shown.length} {shown.length === 1 ? "lesson" : "lessons"} · about {minutes} min
        </div>

        {pages > 1 && (
          <div className="ld-pager" role="navigation" aria-label="Pages">
            <button type="button" aria-label="Previous page" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>‹</button>
            {Array.from({ length: pages }, (_, i) => (
              <button key={i} type="button" className={i === safePage ? "is-on" : ""} aria-current={i === safePage ? "page" : undefined} onClick={() => setPage(i)}>
                {i + 1}
              </button>
            ))}
            <button type="button" aria-label="Next page" disabled={safePage >= pages - 1} onClick={() => setPage(safePage + 1)}>›</button>
          </div>
        )}

        <button type="button" className="ld-continue" disabled={!next} onClick={() => next && onLearn?.(next.id)}>
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M8 5l11 7-11 7z" fill="currentColor" /></svg>
          {next && progress[next.id] ? "Review a lesson" : "Continue learning"}
        </button>
      </div>
    </div>
  );
}
