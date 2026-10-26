import { useCallback, useEffect, useState } from "react";
import Board from "./Board";
import { loadToday, setStepDone } from "./todayData";
import "./Today.css";

function go(page) {
  window.dispatchEvent(new CustomEvent("qelvaris-navigate", { detail: page }));
}

// Negative numbers ko "−134" jaisa dikhao (asli minus sign)
const minus = (n) => String(n).replace("-", "−");

function Sample() {
  return <span className="qt-sample">Sample data</span>;
}

function PlanCard({ data, dateLabel, onToggle }) {
  const { steps } = data.plan;
  const doneCount = steps.filter((s) => data.doneIds.includes(s.id)).length;
  const firstOpen = steps.find((s) => !data.doneIds.includes(s.id));

  return (
    <section className="qt-card">
      <div className="qt-plan-head">
        <div>
          <div className="qt-eyebrow">{dateLabel}</div>
          <h2 className="qt-h2">Today&rsquo;s 15 minutes</h2>
        </div>
        <span className="qt-donepill">
          {doneCount} of {steps.length} done
        </span>
      </div>

      <ol className="qt-steps">
        {steps.map((step, i) => {
          const done = data.doneIds.includes(step.id);
          const isCurrent = !done && firstOpen?.id === step.id;
          const state = done ? "done" : isCurrent ? "current" : "next";

          return (
            <li key={step.id} className={`qt-step qt-step--${state}`}>
              <button
                className="qt-check"
                onClick={() => onToggle(step.id, !done)}
                aria-label={done ? `Mark ${step.kind} as not done` : `Mark ${step.kind} as done`}
                aria-pressed={done}
              >
                {done ? "✓" : i + 1}
              </button>

              <div className="qt-step-body">
                <div className="qt-step-title">
                  {step.kind} · {step.title}
                </div>
                <div className="qt-step-from">{step.from}</div>
              </div>

              <span className="qt-min">{step.minutes} min</span>

              <div className="qt-act-col">
                {done ? (
                  <span className="qt-pill-done">Done</span>
                ) : isCurrent ? (
                  <button className="qt-act qt-act--go" onClick={() => go(step.goTo)}>
                    Start
                  </button>
                ) : (
                  <span className="qt-act qt-act--next">Up next</span>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {data.plan.isSample && (
        <p className="qt-note">
          Plan sample hai, kyunki abhi koi game review nahi hui. Games add karke review karo, tab ye aapke asli leaks se banega.
        </p>
      )}
    </section>
  );
}

function LastGameCard({ game }) {
  return (
    <section className="qt-card qt-last">
      <div className="qt-last-board">
        <Board fen={game.fen} showCoords={false} />
      </div>

      <div className="qt-last-info">
        <div className="qt-eyebrow">
          Last game{game.source ? ` · ${game.source}` : ""} {game.isSample && <Sample />}
        </div>
        <div className="qt-last-title">
          {game.title}
          {game.result ? ` · ${game.result}` : ""}
        </div>
        <div className="qt-last-meta">
          {game.accuracy !== null && game.accuracy !== undefined ? (
            <strong className="qt-acc">Accuracy {game.accuracy}</strong>
          ) : (
            <span>Not reviewed yet</span>
          )}
          {game.turningPoints ? <span> · {game.turningPoints} turning points found</span> : null}
        </div>
        <div className="qt-actions">
          <button className="qt-btn" onClick={() => go("Review")}>
            Open story
          </button>
          <button className="qt-btn" onClick={() => go("Games")}>
            All games
          </button>
        </div>
      </div>
    </section>
  );
}

function LeakCard({ leaks }) {
  const max = Math.max(...leaks.leaks.map((l) => Math.abs(l.points)), 1);

  return (
    <section className="qt-card">
      <div className="qt-eyebrow">
        Leak score · {leaks.windowLabel} {leaks.isSample && <Sample />}
      </div>

      <div className="qt-scorerow">
        <div className="qt-score">{minus(leaks.total)}</div>
        <div className="qt-scoretext">
          <strong>rating points lost to leaks</strong>
          <span>an estimate from how often each leak decides a game</span>
        </div>
      </div>

      {leaks.leaks.length === 0 && <p className="qt-note">Abhi koi leak nahi mila. Aur games review karo.</p>}

      <ul className="qt-leaks">
        {leaks.leaks.map((leak) => (
          <li key={leak.name} className="qt-leak">
            <div className="qt-leak-row">
              <span>{leak.name}</span>
              <span className="qt-leak-pts">{minus(leak.points)}</span>
            </div>
            <div className="qt-bar">
              <div className="qt-bar-fill" style={{ width: `${(Math.abs(leak.points) / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>

      <div className="qt-leakfoot">
        <span>{leaks.moreCount > 0 ? `+ ${leaks.moreCount} more leaks` : ""}</span>
        <button className="qt-link" onClick={() => go("DNA")}>
          See all in DNA →
        </button>
      </div>
    </section>
  );
}

function WeekCard({ streak, status }) {
  return (
    <section className="qt-card">
      <div className="qt-card-head">
        <div className="qt-eyebrow">This week</div>
        <span className="qt-streak">{streak.count} day streak</span>
      </div>

      <div className="qt-week">
        {streak.week.map((day, i) => (
          <span
            key={day.key + i}
            className={`qt-dot ${day.done ? "is-done" : ""} ${day.isToday ? "is-today" : ""} ${day.isFuture ? "is-future" : ""}`}
            aria-label={`${day.label}: ${day.done ? "session finished" : "no finished session"}`}
          >
            {day.label}
          </span>
        ))}
      </div>

      <p className="qt-note qt-note--tight">A streak day means a finished session, not just a login.</p>

      <div className="qt-status">
        <div>
          <strong className="qt-n qt-n--good">{status.fixed}</strong>
          <span>Fixed</span>
        </div>
        <div>
          <strong className="qt-n qt-n--warn">{status.improving}</strong>
          <span>Improving</span>
        </div>
        <div>
          <strong className="qt-n qt-n--bad">{status.open}</strong>
          <span>Still open</span>
        </div>
      </div>
    </section>
  );
}

export default function Today() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    loadToday()
      .then((result) => {
        if (alive) setData(result);
      })
      .catch((err) => {
        console.error("Today load failed:", err);
        if (alive) setError("Today ka data load nahi ho paya. Page refresh karke dekho.");
      });

    return () => {
      alive = false;
    };
  }, []);

  const onToggle = useCallback(async (id, done) => {
    try {
      const next = await setStepDone(id, done);
      setData((prev) => (prev ? { ...prev, ...next } : prev));
    } catch (err) {
      console.error("Could not save step:", err);
    }
  }, []);

  if (error) return <div className="qt-page"><p className="qt-note">{error}</p></div>;
  if (!data) return <div className="qt-page"><p className="qt-note">Loading…</p></div>;

  const dateLabel = new Date()
    .toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })
    .toUpperCase();

  return (
    <div className="qt-page">
      <div className="qt-grid">
        <div className="qt-col">
          <PlanCard data={data} dateLabel={dateLabel} onToggle={onToggle} />
          <LastGameCard game={data.lastGame} />
        </div>

        <div className="qt-col">
          <LeakCard leaks={data.leaks} />
          <WeekCard streak={data.streak} status={data.leaks.status} />
        </div>
      </div>
    </div>
  );
}