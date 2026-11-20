import { useEffect, useMemo, useState } from "react";
import { getMiddlegames } from "./middlegameBuild";
import { loadProgress } from "./lessonStorage";
import "./LabDashboard.css";

// Progress page: sirf asli lesson data se (kitne lessons hue, first-try score, opening-wise bar, recent lessons).

export default function LabProgress({ repertoireCount = 0, onLearn, onOpenLab }) {
  const all = getMiddlegames().list;
  const [progress, setProgress] = useState(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let alive = true;
    loadProgress().then((p) => alive && setProgress(p));
    return () => {
      alive = false;
    };
  }, []);

  const view = useMemo(() => {
    if (!progress) return null;
    const done = all.filter((m) => progress[m.id]);
    const plays = done.reduce((sum, m) => sum + (progress[m.id].plays || 0), 0);
    const scored = done.filter((m) => typeof progress[m.id].best === "number" && progress[m.id].total > 0);
    const ratio = scored.length
      ? Math.round((scored.reduce((sum, m) => sum + progress[m.id].best / progress[m.id].total, 0) / scored.length) * 100)
      : null;

    const byOpening = new Map();
    for (const m of all) {
      const row = byOpening.get(m.opening) || { name: m.opening, done: 0, total: 0 };
      row.total += 1;
      if (progress[m.id]) row.done += 1;
      byOpening.set(m.opening, row);
    }

    const recent = [...done]
      .sort((a, b) => String(progress[b.id].completedAt).localeCompare(String(progress[a.id].completedAt)))
      .slice(0, 5);

    return { done, plays, ratio, rows: [...byOpening.values()].sort((a, b) => b.done - a.done || b.done / b.total - a.done / a.total), recent };
  }, [all, progress]);

  if (!view) return <p className="qo-note">Loading your progress...</p>;

  const percent = all.length ? Math.round((view.done.length / all.length) * 100) : 0;

  return (
    <div className="ld lp">
      <header className="qs-head">
        <div className="qs-head-copy">
          <div className="qs-head-eyebrow">Your learning</div>
          <h2>
            Opening <span>Progress</span>
          </h2>
          <p>Everything here comes from the lessons you have actually completed on this device.</p>
        </div>
      </header>

      <div className="lp-tiles">
        <div className="lp-tile">
          <strong>
            {view.done.length}
            <small>/{all.length}</small>
          </strong>
          <span>Lessons completed</span>
          <div className="qs-bar"><span style={{ width: `${percent}%` }} /></div>
        </div>
        <div className="lp-tile">
          <strong>{view.ratio === null ? "–" : `${view.ratio}%`}</strong>
          <span>Average first-try score</span>
        </div>
        <div className="lp-tile">
          <strong>{view.plays}</strong>
          <span>Lesson sessions played</span>
        </div>
        <div className="lp-tile">
          <strong>{repertoireCount}</strong>
          <span>Openings in your repertoire</span>
        </div>
      </div>

      <div className="lp-cols">
        <section className="ld-panel">
          <div className="qo-eyebrow">By opening</div>
          <ul className="lp-rows">
            {(showAll ? view.rows : view.rows.slice(0, 8)).map((row) => (
              <li key={row.name}>
                <div className="lp-row-top">
                  <span>{row.name}</span>
                  <b>{row.done}/{row.total}</b>
                </div>
                <div className="qs-bar"><span style={{ width: `${(row.done / row.total) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
          {view.rows.length > 8 && (
            <button type="button" className="lp-more" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Show fewer" : `Show all ${view.rows.length} openings`}
            </button>
          )}
        </section>

        <section className="ld-panel">
          <div className="qo-eyebrow">Recently completed</div>
          {view.recent.length === 0 ? (
            <div className="lp-empty">
              <p className="qo-note">You have not finished a lesson yet. Start with a short one.</p>
              <button type="button" className="ld-learn" onClick={onOpenLab}>Open Middlegame Lab</button>
            </div>
          ) : (
            <ul className="lp-recent">
              {view.recent.map((m) => (
                <li key={m.id}>
                  <div>
                    <b>{m.title}</b>
                    <span>{m.opening} · {progress[m.id].best > 0 ? `best ${progress[m.id].best}/${progress[m.id].total}` : "watched"}</span>
                  </div>
                  <button type="button" className="ld-play" onClick={() => onLearn?.(m.id)}>Learn again</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
