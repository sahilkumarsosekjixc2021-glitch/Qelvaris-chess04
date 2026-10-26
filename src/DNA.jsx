import { useEffect, useMemo, useState } from "react";
import { computeLeaks, loadReviewedGames } from "./leaks";
import { averageAccuracy, clockAccuracy, computeSkills, periodRecords, verdict } from "./skills";
import { setSetting } from "./storage";
import "./DNA.css";

const WINDOWS = [
  { id: "30", label: "30 days" },
  { id: "90", label: "90 days" },
  { id: "all", label: "All time" },
];

function goTo(page) {
  window.dispatchEvent(new CustomEvent("qelvaris-navigate", { detail: page }));
}

async function trainLeak(id) {
  try {
    await setSetting("labLeak", id);
  } catch (error) {
    console.error("Could not save leak choice:", error);
  }
  goTo("Leak Lab");
}

const tone = (v) => (v === null || v === undefined ? "none" : v >= 70 ? "good" : v >= 55 ? "warn" : "bad");
const show = (value) => (value === null || value === undefined ? "—" : value);

/* Six skills ka hexagon. Beech ka ring: pehle ka period (dashed) */
function Radar({ skills, previous }) {
  const width = 520;
  const height = 440;
  const center = width / 2;
  const middle = height / 2;
  const radius = 130;

  const point = (index, value, scale = 1) => {
    const angle = -Math.PI / 2 + (index * Math.PI) / 3;
    const r = radius * (value / 100) * scale;
    return [center + r * Math.cos(angle), middle + r * Math.sin(angle)];
  };

  const shape = (list) => list.map((item, i) => point(i, item.value ?? 0).join(",")).join(" ");
  const ring = (value) => skills.map((_, i) => point(i, value).join(",")).join(" ");
  const hasPrevious = previous && previous.some((item) => item.value !== null);

  return (
    <svg className="dn-radar" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Six skills chart">
      {[25, 50, 75, 100].map((value) => (
        <polygon key={value} points={ring(value)} className="dn-ring" />
      ))}

      {skills.map((_, i) => {
        const [x, y] = point(i, 100);
        return <line key={i} x1={center} y1={middle} x2={x} y2={y} className="dn-axis" />;
      })}

      {hasPrevious && <polygon points={shape(previous)} className="dn-prev" />}
      <polygon points={shape(skills)} className="dn-now" />

      {skills.map((item, i) => {
        const [x, y] = point(i, 100, 1.22);
        const [px, py] = point(i, item.value ?? 0);
        const cos = Math.cos(-Math.PI / 2 + (i * Math.PI) / 3);
        const anchor = cos > 0.3 ? "start" : cos < -0.3 ? "end" : "middle";

        return (
          <g key={item.id}>
            {item.value !== null && <circle cx={px} cy={py} r="3.5" className="dn-dot" />}
            <text x={x} y={y - 4 + (Math.abs(cos) < 0.3 ? (Math.sin(-Math.PI / 2 + (i * Math.PI) / 3) > 0 ? 14 : -8) : 0)} textAnchor={anchor} className="dn-label">
              {item.label}
            </text>
            <text x={x} y={y + 14 + (Math.abs(cos) < 0.3 ? (Math.sin(-Math.PI / 2 + (i * Math.PI) / 3) > 0 ? 14 : -8) : 0)} textAnchor={anchor} className="dn-value">
              {show(item.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function DNA() {
  const [records, setRecords] = useState(null);
  const [days, setDays] = useState("30");

  useEffect(() => {
    let alive = true;

    loadReviewedGames()
      .then((loaded) => {
        if (alive) setRecords(loaded);
      })
      .catch((error) => {
        console.error("Could not load games:", error);
        if (alive) setRecords([]);
      });

    return () => {
      alive = false;
    };
  }, []);

  const periods = useMemo(() => (records ? periodRecords(records, days) : null), [records, days]);
  const skills = useMemo(() => (periods ? computeSkills(periods.current) : []), [periods]);
  const previousSkills = useMemo(() => (periods && periods.previous.length ? computeSkills(periods.previous) : null), [periods]);
  const report = useMemo(() => (periods ? computeLeaks(periods.current, records) : null), [periods, records]);
  const previousReport = useMemo(
    () => (periods && periods.previous.length ? computeLeaks(periods.previous, records) : null),
    [periods, records]
  );
  const clocks = useMemo(() => (periods ? clockAccuracy(periods.current) : null), [periods]);

  if (records === null) {
    return (
      <div className="dn-page">
        <p className="q-muted">Reading your games…</p>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="dn-page">
        <section className="q-card dn-blank">
          <h1 className="q-title">Your chess DNA needs games</h1>
          <p className="q-muted">
            This page is built only from games you have played and had checked by the engine. Add your games to see your
            six skills and the habits that cost you rating points.
          </p>
          <button className="q-btn q-btn--primary" onClick={() => goTo("Connect")}>
            Add games
          </button>
        </section>
      </div>
    );
  }

  const current = periods.current;
  const accNow = averageAccuracy(current);
  const accPrev = periods.previous.length ? averageAccuracy(periods.previous) : null;
  const leakNow = report.total;
  const leakPrev = previousReport ? previousReport.total : null;

  const measured = skills.filter((item) => item.value !== null);
  const weakest = measured.length ? measured.reduce((a, b) => (b.value < a.value ? b : a)) : null;
  const note = verdict({ leakNow, leakPrev, accNow, accPrev, weakest: weakest?.label });
  const maxPoints = Math.max(...report.leaks.map((l) => l.points), 1);
  const windowLabel = WINDOWS.find((w) => w.id === days).label;

  return (
    <div className="dn-page">

      {current.length === 0 ? (
        <section className="q-card dn-blank">
          <h2 className="dn-h2">No reviewed games in the last {windowLabel}</h2>
          <p className="q-muted">Pick a longer window, or add more recent games.</p>
          <button className="q-btn" onClick={() => setDays("all")}>
            Show all time
          </button>
        </section>
      ) : (
        <div className="dn-grid">
          {/* Skills */}
          <section className="q-card dn-skills">
            <div className="dn-card-head">
              <span className="q-eyebrow">
                Six skills · {days === "all" ? "all time" : `last ${windowLabel}`} · {current.length}{" "}
                {current.length === 1 ? "game" : "games"}
              </span>
              <div className="dn-windows" role="group" aria-label="Time window">
                {WINDOWS.map((item) => (
                  <button
                    key={item.id}
                    className={`dn-win ${days === item.id ? "is-on" : ""}`}
                    onClick={() => setDays(item.id)}
                    aria-pressed={days === item.id}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <Radar skills={skills} previous={previousSkills} />

            <div className="dn-legend">
              <span>
                <i className="dn-key dn-key--now" /> Now
              </span>
              {previousSkills && (
                <span>
                  <i className="dn-key dn-key--prev" /> {windowLabel} ago
                </span>
              )}
            </div>

            <p className="q-muted dn-small">
              Each skill is the average accuracy of your moves in that situation. A skill needs at least 8 such moves to
              show a number.
            </p>
          </section>

          <div className="dn-right">
          {/* Leaks */}
          <section className="q-card dn-leaks">
            <span className="q-eyebrow">Leaks ranked by rating points lost (estimate)</span>

            {report.leaks.length === 0 ? (
              <p className="q-muted dn-empty">No repeating habits found in these games. Keep playing and checking.</p>
            ) : (
              <ol className="dn-leaklist">
                {report.leaks.slice(0, 6).map((leak, i) => (
                  <li key={leak.id} className="dn-leak">
                    <span className="dn-rank">{i + 1}</span>

                    <div className="dn-leak-main">
                      <strong>
                        {leak.title}
                        {leak.status !== "Open" && (
                          <span className={`q-badge ${leak.status === "Fixed" ? "q-badge--good" : "q-badge--accent"} dn-status`}>
                            {leak.status}
                          </span>
                        )}
                      </strong>
                      <span className="dn-leak-text" title={leak.text}>
                        {leak.text} Found in {leak.games} of {report.games} {report.games === 1 ? "game" : "games"}.
                      </span>
                    </div>

                    <div className="dn-bar" aria-hidden="true">
                      <div style={{ width: `${(leak.points / maxPoints) * 100}%` }} />
                    </div>

                    <strong className="dn-points">{"\u2212"}{leak.points}</strong>

                    <button className="dn-train" onClick={() => trainLeak(leak.id)}>
                      Train this
                    </button>
                  </li>
                ))}
              </ol>
            )}

            <p className="q-muted dn-small">
              Points are an estimate: how much winning chance each habit costs per game, converted to rating points.
            </p>
          </section>

          <div className="dn-bottom">
          {/* Clock */}
          <section className="q-card">
            <span className="q-eyebrow">Accuracy by time left on the clock</span>

            {clocks.hasClocks ? (
              <div className="dn-clock">
                {clocks.buckets.map((bucket) => (
                  <div key={bucket.id} className="dn-clock-col">
                    <strong className="q-mono dn-clock-num">{show(bucket.value)}</strong>
                    <div className="dn-clock-bar">
                      <div className={`dn-tone dn-tone--${tone(bucket.value)}`} style={{ height: `${bucket.value ?? 0}%` }} />
                    </div>
                    <span className="q-muted">{bucket.label}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="q-muted dn-empty">
                These games have no clock data. Games imported from Lichess or Chess.com usually include it.
              </p>
            )}
          </section>

          {/* Compare */}
          <section className="q-card dn-compare">
            <span className="q-eyebrow">{days === "all" ? "Overall" : `You versus the ${windowLabel} before`}</span>

            <div className="dn-compare-row">
              <span>Leak score</span>
              <span className="dn-from">{leakPrev !== null ? `\u2212${leakPrev} \u2192` : ""}</span>
              <strong className={`dn-now-num ${leakPrev !== null && leakNow < leakPrev ? "is-good" : ""}`}>{"\u2212"}{leakNow}</strong>
            </div>
            <div className="dn-compare-row">
              <span>Average accuracy</span>
              <span className="dn-from">{accPrev !== null ? `${accPrev.toFixed(1)} \u2192` : ""}</span>
              <strong className={`dn-now-num ${accPrev !== null && accNow > accPrev ? "is-good" : ""}`}>
                {accNow !== null ? accNow.toFixed(1) : "\u2014"}
              </strong>
            </div>

            <p className="dn-verdict">
              {note || (days === "all" ? "Choose 30 or 90 days to compare with the period before." : "Not enough earlier games yet to compare.")}
            </p>
          </section>
          </div>
          </div>
        </div>
      )}
    </div>
  );
}